/**
 * Credit top-up settlement for Stripe checkout.session.completed.
 * No stripe npm package — signature verify lives in stripe-webhook.server.ts.
 *
 * Wallet units: credit_wallets.credit_cents stores EUR cents
 * (1000 credits = €1 = 100 cents).
 */
import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  calculateSubscriptionGrant,
  creditsToWalletCents,
  parseTopUpMetadata,
} from "@/lib/credit-pricing";

export type TopUpGrantResult = {
  success: true;
  userId: string;
  creditsGranted: number;
  subscriptionGrant: number;
  totalCredits: number;
  centsGranted: number;
  stripeSessionId: string;
  alreadySettled?: boolean;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function ledgerId(): string {
  return `ul_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Grant top-up credits + 10% bonus. Idempotent on stripe_event_id.
 */
export async function grantTopUpFromCheckout(input: {
  stripeEventId: string;
  stripeSessionId: string;
  userId: string;
  creditsToGrant: number;
  amountEuros: number;
  markupTier: number;
}): Promise<TopUpGrantResult> {
  const { getSql } = await import("@/lib/db");
  const { ensureFreeEntitlement } = await import(
    "@/lib/auth/entitlements.server"
  );

  const sql = await getSql();
  await ensureFreeEntitlement(input.userId);

  const existing = await sql<{ id: string }>`
    select id from usage_ledger
    where stripe_event_id = ${input.stripeEventId}
    limit 1
  `;
  if (existing.length > 0) {
    const grantAmount = calculateSubscriptionGrant(input.creditsToGrant);
    const totalCredits = input.creditsToGrant + grantAmount;
    return {
      success: true,
      userId: input.userId,
      creditsGranted: input.creditsToGrant,
      subscriptionGrant: grantAmount,
      totalCredits,
      centsGranted: creditsToWalletCents(totalCredits),
      stripeSessionId: input.stripeSessionId,
      alreadySettled: true,
    };
  }

  const wallet = await sql<{ credit_cents: number }>`
    select credit_cents from credit_wallets
    where user_id = ${input.userId}
    limit 1
  `;
  if (wallet.length === 0) {
    throw new Error(`Wallet not found for user ${input.userId}`);
  }

  const grantAmount = calculateSubscriptionGrant(input.creditsToGrant);
  const topUpCents = creditsToWalletCents(input.creditsToGrant);
  const grantCents = creditsToWalletCents(grantAmount);
  const totalCredits = input.creditsToGrant + grantAmount;
  const totalCents = topUpCents + grantCents;

  const topUpMeta = JSON.stringify({
    source: "top_up_payment",
    amountEuros: input.amountEuros.toString(),
    markupTier: input.markupTier.toString(),
    stripeSessionId: input.stripeSessionId,
    creditsAwarded: input.creditsToGrant,
  });

  await sql`
    insert into usage_ledger (
      id, user_id, kind, cents_delta, stripe_event_id, meta
    ) values (
      ${ledgerId()},
      ${input.userId},
      ${"credit_grant"},
      ${topUpCents},
      ${input.stripeEventId},
      ${topUpMeta}::jsonb
    )
  `;

  if (grantAmount > 0 && grantCents > 0) {
    const grantMeta = JSON.stringify({
      source: "subscription_grant",
      parentTransaction: input.stripeSessionId,
      grantPercentage: "10",
      creditsAwarded: grantAmount,
    });
    await sql`
      insert into usage_ledger (
        id, user_id, kind, cents_delta, meta
      ) values (
        ${ledgerId()},
        ${input.userId},
        ${"credit_grant"},
        ${grantCents},
        ${grantMeta}::jsonb
      )
    `;
  }

  if (totalCents > 0) {
    await sql`
      update credit_wallets
      set
        credit_cents = credit_cents + ${totalCents},
        updated_at = now()
      where user_id = ${input.userId}
    `;
  }

  console.log(
    `[stripe-topup] Credits granted to user ${input.userId}: ${input.creditsToGrant} (top-up) + ${grantAmount} (10% grant) = ${totalCredits} total (${totalCents} cents)`,
  );

  return {
    success: true,
    userId: input.userId,
    creditsGranted: input.creditsToGrant,
    subscriptionGrant: grantAmount,
    totalCredits,
    centsGranted: totalCents,
    stripeSessionId: input.stripeSessionId,
  };
}

const webhookInput = z.object({
  body: z.string(),
  signature: z.string(),
});

export const handleStripeWebhook = createServerFn({ method: "POST" })
  .validator(webhookInput)
  .handler(async ({ data }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new Error("Stripe webhook is not configured");
    }

    const { StripeSignatureError, verifyStripeSignature } = await import(
      "@/lib/billing/stripe-webhook.server"
    );

    try {
      verifyStripeSignature(data.body, data.signature, secret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      if (err instanceof StripeSignatureError) {
        throw new Error("Webhook signature verification failed");
      }
      throw err;
    }

    let parsed: {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    try {
      parsed = JSON.parse(data.body) as typeof parsed;
    } catch {
      throw new Error("Invalid JSON body");
    }

    if (parsed.type !== "checkout.session.completed") {
      return { received: true, processed: false as const };
    }

    const session = (parsed.data?.object ?? {}) as Record<string, unknown>;
    const metadata =
      session.metadata && typeof session.metadata === "object"
        ? (session.metadata as Record<string, unknown>)
        : null;
    const grant = parseTopUpMetadata(metadata);
    if (!grant) {
      return { received: true, processed: false as const };
    }

    const sessionId = asString(session.id) ?? parsed.id ?? "";
    const result = await grantTopUpFromCheckout({
      stripeEventId: parsed.id ?? sessionId,
      stripeSessionId: sessionId,
      userId: grant.userId,
      creditsToGrant: grant.creditsToGrant,
      amountEuros: grant.amountEuros,
      markupTier: grant.markupTier,
    });

    return {
      received: true,
      processed: true as const,
      ...result,
    };
  });
