/**
 * POST server function: create a Stripe Checkout Session for a credit top-up.
 * Client-safe import — Stripe/DB only load inside the handler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { calculateCredits } from "@/lib/credit-pricing";

const topUpInput = z.object({
  amountEuros: z.number(),
});

async function resolveAppUrl(): Promise<string> {
  const fromEnv =
    process.env.BETTER_AUTH_URL?.trim() || process.env.VITE_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  if (req) return new URL(req.url).origin;
  return "http://localhost:8080";
}

export const createTopUpCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(topUpInput)
  .handler(async ({ data, context }) => {
    const { amountEuros } = data;
    const userId = context.userId;

    let pricing;
    try {
      pricing = calculateCredits(amountEuros);
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Invalid top-up amount",
      );
    }

    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const {
      StripeApiError,
      StripeNotConfiguredError,
      ensureFreeEntitlement,
      ensureStripeCustomer,
    } = await import("@/lib/auth/entitlements.server");
    const { getSql } = await import("@/lib/db");

    const session = await getSessionUser();
    let email = session?.email ?? null;
    if (!email) {
      const sql = await getSql();
      const rows = await sql<{ email: string | null }>`
        select email from "user" where id = ${userId} limit 1
      `;
      email = rows[0]?.email ?? null;
    }
    if (!email) throw new Error("User email not found");
    await ensureFreeEntitlement(userId);

    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new StripeNotConfiguredError();
    }

    let customerId: string | null = null;
    try {
      const ensured = await ensureStripeCustomer(userId, email);
      customerId = ensured.stripeCustomerId;
    } catch (err) {
      if (err instanceof StripeNotConfiguredError) throw err;
      customerId = null;
    }

    const appUrl = await resolveAppUrl();
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.append("payment_method_types[0]", "card");
    body.set("success_url", `${appUrl}/dashboard/credits?success=true`);
    body.set("cancel_url", `${appUrl}/dashboard/credits?cancelled=true`);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "eur");
    body.set(
      "line_items[0][price_data][unit_amount]",
      String(Math.round(amountEuros * 100)),
    );
    body.set(
      "line_items[0][price_data][product_data][name]",
      `${pricing.creditsAwarded.toLocaleString("en-US")} Credits`,
    );
    body.set(
      "line_items[0][price_data][product_data][description]",
      "Absolute Truth Studio Credits",
    );
    if (customerId) {
      body.set("customer", customerId);
    } else {
      body.set("customer_email", email);
    }
    body.set("metadata[kind]", "credit_topup");
    body.set("metadata[userId]", userId);
    body.set("metadata[user_id]", userId);
    body.set("metadata[amountEuros]", amountEuros.toString());
    body.set("metadata[creditsToGrant]", pricing.creditsAwarded.toString());
    body.set("metadata[markupTier]", pricing.markupTier.toString());
    body.set("metadata[apiBudgetCost]", pricing.apiBudgetCost.toFixed(2));
    body.set("client_reference_id", userId);

    const { randomUUID } = await import("node:crypto");
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `ats-topup-${userId}-${randomUUID()}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      let stripeType: string | undefined;
      let message = `Stripe checkout create failed (${res.status})`;
      try {
        const errJson = (await res.json()) as {
          error?: { type?: string; code?: string };
        };
        stripeType = errJson.error?.type;
        if (errJson.error?.code) {
          message = `Stripe checkout create failed: ${errJson.error.code}`;
        }
      } catch {
        // ignore parse errors
      }
      console.error("[top-up] Stripe checkout create failed", {
        userId,
        status: res.status,
        stripeType,
      });
      throw new StripeApiError(502, message, stripeType);
    }

    const checkout = (await res.json()) as { id?: string; url?: string | null };
    if (!checkout.url || !checkout.id) {
      throw new StripeApiError(502, "Failed to create checkout session");
    }

    return {
      checkoutUrl: checkout.url,
      sessionId: checkout.id,
      creditsPreview: pricing.creditsAwarded,
    };
  });
