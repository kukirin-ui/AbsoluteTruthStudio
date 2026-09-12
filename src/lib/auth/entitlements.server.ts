/**
 * Server-only Scale entitlements helpers (Neon / PGLite via getSql).
 * Never import from client code.
 *
 * Premium / Pro grants happen ONLY via Stripe webhook settle (Backend) —
 * this module provisions free rows + Stripe Customer ids only.
 */
import { getSql } from "@/lib/db";

/** Thrown when STRIPE_SECRET_KEY is missing; route maps to 503 STRIPE_NOT_CONFIGURED. */
export class StripeNotConfiguredError extends Error {
  readonly code = "STRIPE_NOT_CONFIGURED" as const;
  readonly status = 503;
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

/** Thrown when Stripe REST returns a non-OK response (no secret/PII in message). */
export class StripeApiError extends Error {
  readonly code = "STRIPE_API_ERROR" as const;
  readonly status: number;
  readonly stripeType?: string;
  constructor(status: number, message: string, stripeType?: string) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.stripeType = stripeType;
  }
}

/**
 * Ensure a free entitlements row + zero credit wallet for the Better Auth user.
 * ON CONFLICT DO NOTHING — safe to call from user.create after and ensureStripeCustomer.
 */
export async function ensureFreeEntitlement(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into entitlements (user_id, plan, buffer_cents_total, buffer_cents_remaining)
    values (${userId}, 'free', 0, 0)
    on conflict (user_id) do nothing
  `;
  await sql`
    insert into credit_wallets (user_id, credit_cents)
    values (${userId}, 0)
    on conflict (user_id) do nothing
  `;
}

type EntitlementStripeRow = {
  stripe_customer_id: string | null;
  plan: string;
};

/**
 * Ensure the user has a Stripe Customer and persist `entitlements.stripe_customer_id`.
 * Idempotent via Stripe Idempotency-Key `ats-cust-{userId}` and DB null-only update.
 */
export async function ensureStripeCustomer(
  userId: string,
  email: string | null,
): Promise<{ stripeCustomerId: string; created: boolean }> {
  const sql = await getSql();

  const existing = await sql<EntitlementStripeRow>`
    select stripe_customer_id, plan from entitlements where user_id = ${userId} limit 1
  `;
  const currentId = existing[0]?.stripe_customer_id ?? null;
  if (currentId) {
    return { stripeCustomerId: currentId, created: false };
  }

  await ensureFreeEntitlement(userId);

  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeNotConfiguredError();
  }

  const body = new URLSearchParams();
  if (email) body.set("email", email);
  body.set("metadata[user_id]", userId);

  // Do not log the secret key or full Stripe payloads with PII beyond user id.
  const res = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `ats-cust-${userId}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    let stripeType: string | undefined;
    let message = `Stripe customer create failed (${res.status})`;
    try {
      const errJson = (await res.json()) as {
        error?: { type?: string; code?: string; message?: string };
      };
      stripeType = errJson.error?.type;
      // Keep message short — no card data; avoid echoing full Stripe body.
      if (errJson.error?.code) message = `Stripe customer create failed: ${errJson.error.code}`;
    } catch {
      // ignore parse errors
    }
    console.error("[entitlements] Stripe customer create failed", {
      userId,
      status: res.status,
      stripeType,
    });
    throw new StripeApiError(502, message, stripeType);
  }

  const customer = (await res.json()) as { id?: string };
  const stripeCustomerId = customer.id;
  if (!stripeCustomerId || typeof stripeCustomerId !== "string") {
    console.error("[entitlements] Stripe customer create returned no id", { userId });
    throw new StripeApiError(502, "Stripe customer create returned no id");
  }

  // Persist only if still null — never overwrite a different customer id (race).
  const updated = await sql`
    update entitlements
    set stripe_customer_id = ${stripeCustomerId}, updated_at = now()
    where user_id = ${userId} and stripe_customer_id is null
    returning stripe_customer_id
  `;

  if (updated.length > 0) {
    return { stripeCustomerId, created: true };
  }

  const again = await sql<EntitlementStripeRow>`
    select stripe_customer_id, plan from entitlements where user_id = ${userId} limit 1
  `;
  const winner = again[0]?.stripe_customer_id;
  if (winner) {
    return { stripeCustomerId: winner, created: false };
  }

  // Extremely unlikely: row missing after ensureFreeEntitlement.
  throw new StripeApiError(500, "Failed to persist stripe_customer_id");
}

/** Read plan for the ensure-customer success payload. */
export async function getEntitlementPlan(userId: string): Promise<string> {
  const sql = await getSql();
  const rows = await sql<{ plan: string }>`
    select plan from entitlements where user_id = ${userId} limit 1
  `;
  return rows[0]?.plan ?? "free";
}
