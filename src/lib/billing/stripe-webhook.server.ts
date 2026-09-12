/**
 * Stripe webhook signature verify + settle (server-only).
 * No stripe npm package — HMAC via node:crypto.
 * Premium/Pro grants ONLY via SCALE_SETTLE_EVENTS settle path.
 *
 * Heavy DB deps are loaded lazily inside settleStripeEvent so
 * verifyStripeSignature can be unit-tested without Vite/PGLite.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PlanId } from "@/lib/types";
import { isScaleSettleEvent } from "../auth/scale-contract.ts";

const DEFAULT_BUFFER_RATE_BPS = 0;
const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export class StripeSignatureError extends Error {
  readonly code = "BAD_SIGNATURE" as const;
  constructor(message = "Invalid Stripe signature") {
    super(message);
    this.name = "StripeSignatureError";
  }
}

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Verify Stripe-Signature header (t=…,v1=…) against raw body.
 * Throws StripeSignatureError on failure.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSec = 300,
): void {
  if (!header || !secret) {
    throw new StripeSignatureError("Missing signature header or secret");
  }

  const parts = header.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  const v1Sigs: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const val = part.slice(eq + 1);
    if (key === "t") timestamp = val;
    else if (key === "v1") v1Sigs.push(val);
  }

  if (!timestamp || v1Sigs.length === 0) {
    throw new StripeSignatureError("Malformed Stripe-Signature header");
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) {
    throw new StripeSignatureError("Invalid signature timestamp");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > toleranceSec) {
    throw new StripeSignatureError("Signature timestamp outside tolerance");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHex = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedHex, "utf8");

  let matched = false;
  for (const sig of v1Sigs) {
    const sigBuf = Buffer.from(sig, "utf8");
    if (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    ) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    throw new StripeSignatureError("Signature mismatch");
  }
}

function planFromPriceId(
  priceId: string | null | undefined,
  priceIds: Record<"pro" | "premium", string>,
): Exclude<PlanId, "free"> | null {
  if (!priceId) return null;
  if (priceId === priceIds.pro) return "pro";
  if (priceId === priceIds.premium) return "premium";
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function unixToDate(sec: number | null | undefined): Date | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000);
}

function bufferCents(amountCents: number, bufferRateBps: number): number {
  return Math.floor((amountCents * bufferRateBps) / 10_000);
}

function extractCustomerId(obj: Record<string, unknown>): string | null {
  const direct = asString(obj.customer);
  if (direct) return direct;
  if (obj.customer && typeof obj.customer === "object") {
    return asString((obj.customer as { id?: unknown }).id);
  }
  return null;
}

function extractPriceId(obj: Record<string, unknown>): string | null {
  const items = obj.items as
    | { data?: Array<{ price?: { id?: string } | string }> }
    | undefined;
  const firstItem = items?.data?.[0];
  if (firstItem) {
    if (typeof firstItem.price === "string") return firstItem.price;
    if (firstItem.price && typeof firstItem.price === "object") {
      return asString(firstItem.price.id);
    }
  }

  const lines = obj.lines as
    | {
        data?: Array<{
          price?: { id?: string } | string;
          pricing?: { price_details?: { price?: string } };
        }>;
      }
    | undefined;
  const firstLine = lines?.data?.[0];
  if (firstLine) {
    if (typeof firstLine.price === "string") return firstLine.price;
    if (firstLine.price && typeof firstLine.price === "object") {
      return asString(firstLine.price.id);
    }
    const nested = firstLine.pricing?.price_details?.price;
    if (nested) return nested;
  }

  const lineItems = obj.line_items as
    | { data?: Array<{ price?: { id?: string } | string }> }
    | undefined;
  const firstLi = lineItems?.data?.[0];
  if (firstLi) {
    if (typeof firstLi.price === "string") return firstLi.price;
    if (firstLi.price && typeof firstLi.price === "object") {
      return asString(firstLi.price.id);
    }
  }

  const meta = obj.metadata as Record<string, unknown> | undefined;
  return asString(meta?.price_id) ?? asString(meta?.stripe_price_id);
}

function extractSubscriptionId(obj: Record<string, unknown>): string | null {
  if (asString(obj.object) === "subscription" && asString(obj.id)) {
    return asString(obj.id);
  }
  const sub = obj.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object") {
    return asString((sub as { id?: unknown }).id);
  }
  return null;
}

function extractPeriod(obj: Record<string, unknown>): { start: Date; end: Date } {
  const startSec =
    asNumber(obj.current_period_start) ??
    asNumber((obj as { period_start?: unknown }).period_start);
  const endSec =
    asNumber(obj.current_period_end) ??
    asNumber((obj as { period_end?: unknown }).period_end);

  const start = unixToDate(startSec) ?? new Date();
  const end =
    unixToDate(endSec) ?? new Date(start.getTime() + DEFAULT_PERIOD_MS);
  return { start, end };
}

function extractBillingInterval(
  obj: Record<string, unknown>,
): "monthly" | "annual" | null {
  const items = obj.items as
    | { data?: Array<{ price?: { recurring?: { interval?: string } } }> }
    | undefined;
  const interval = items?.data?.[0]?.price?.recurring?.interval;
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  const meta = obj.metadata as Record<string, unknown> | undefined;
  const m = asString(meta?.billing_interval);
  if (m === "annual" || m === "monthly") return m;
  return "monthly";
}

/**
 * Settle a Stripe event against entitlements + usage_ledger.
 * Idempotent on stripe_event_id. Never logs secrets/card data.
 */
export async function settleStripeEvent(
  event: {
    id: string;
    type: string;
    data: { object?: Record<string, unknown> };
  },
): Promise<{ ok: true } | { ok: false; code: string; error: string }> {
  if (!event?.id || !event?.type) {
    return { ok: false, code: "VALIDATION", error: "Invalid event shape" };
  }

  if (!isScaleSettleEvent(event.type)) {
    return { ok: true };
  }

  const { getSql } = await import("@/lib/db");
  const { STRIPE_PRICE_IDS, PLANS } = await import("@/lib/billing");
  const { ensureFreeEntitlement } = await import(
    "@/lib/auth/entitlements.server"
  );

  const amountCentsForPlan = (plan: Exclude<PlanId, "free">): number =>
    PLANS.find((p) => p.id === plan)?.amountCents ??
    (plan === "pro" ? 1900 : 4900);

  const alreadySettled = async (stripeEventId: string): Promise<boolean> => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      select id from usage_ledger
      where stripe_event_id = ${stripeEventId}
      limit 1
    `;
    return rows.length > 0;
  };

  const insertLedger = async (input: {
    userId: string;
    kind: "period_reset" | "adjust";
    centsDelta: number;
    stripeEventId: string | null;
    bufferRemainingAfter: number | null;
    meta?: Record<string, unknown>;
  }): Promise<void> => {
    const sql = await getSql();
    const id = `ul_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const metaJson = JSON.stringify(input.meta ?? {});
    await sql`
      insert into usage_ledger (
        id, user_id, kind, cents_delta, buffer_remaining_after, stripe_event_id, meta
      ) values (
        ${id},
        ${input.userId},
        ${input.kind},
        ${input.centsDelta},
        ${input.bufferRemainingAfter},
        ${input.stripeEventId},
        ${metaJson}::jsonb
      )
    `;
  };

  const resolveUserId = async (
    obj: Record<string, unknown>,
    customerId: string | null,
  ): Promise<string | null> => {
    const sql = await getSql();
    if (customerId) {
      const rows = await sql<{ user_id: string }>`
        select user_id from entitlements
        where stripe_customer_id = ${customerId}
        limit 1
      `;
      if (rows[0]?.user_id) return rows[0].user_id;
    }
    const clientRef = asString(obj.client_reference_id);
    if (clientRef) return clientRef;
    const meta = obj.metadata as Record<string, unknown> | undefined;
    return asString(meta?.user_id);
  };

  const grantPaidPlan = async (input: {
    userId: string;
    plan: Exclude<PlanId, "free">;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    periodStart: Date;
    periodEnd: Date;
    billingInterval: "monthly" | "annual" | null;
    stripeEventId: string;
    eventType: string;
  }): Promise<void> => {
    const sql = await getSql();
    await ensureFreeEntitlement(input.userId);

    // CONTRACT: included API buffer = 0% when owner pays provider keys.
    // Usage is user credits / BYOK — seed no sub-% pool on settle.
    // Note: DDL still constrains buffer_rate_bps to 1000–1500; we leave that
    // column alone and force buffer_cents_* = 0 (DEFINE may widen check later).
    const amount = amountCentsForPlan(input.plan);
    const bufferTotal = 0;

    await sql`
      update entitlements
      set
        plan = ${input.plan},
        billing_interval = ${input.billingInterval},
        stripe_customer_id = coalesce(${input.stripeCustomerId}, stripe_customer_id),
        stripe_subscription_id = coalesce(${input.stripeSubscriptionId}, stripe_subscription_id),
        period_start = ${input.periodStart.toISOString()},
        period_end = ${input.periodEnd.toISOString()},
        buffer_cents_total = ${bufferTotal},
        buffer_cents_remaining = ${bufferTotal},
        updated_at = now()
      where user_id = ${input.userId}
    `;

    await insertLedger({
      userId: input.userId,
      kind: "period_reset",
      centsDelta: 0,
      stripeEventId: input.stripeEventId,
      bufferRemainingAfter: 0,
      meta: {
        eventType: input.eventType,
        plan: input.plan,
        amountCents: amount,
        bufferRateBps: DEFAULT_BUFFER_RATE_BPS,
        includedBuffer: false,
      },
    });
  };

  const revokeToFree = async (input: {
    userId: string;
    stripeEventId: string;
    eventType: string;
  }): Promise<void> => {
    const sql = await getSql();
    await sql`
      update entitlements
      set
        plan = 'free',
        billing_interval = null,
        stripe_subscription_id = null,
        buffer_cents_total = 0,
        buffer_cents_remaining = 0,
        updated_at = now()
      where user_id = ${input.userId}
    `;

    await insertLedger({
      userId: input.userId,
      kind: "adjust",
      centsDelta: 0,
      stripeEventId: input.stripeEventId,
      bufferRemainingAfter: 0,
      meta: { eventType: input.eventType, plan: "free" },
    });
  };

  try {
    if (await alreadySettled(event.id)) {
      return { ok: true };
    }

    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const customerId = extractCustomerId(obj);
    const userId = await resolveUserId(obj, customerId);

    if (!userId) {
      console.error("[stripe-webhook] cannot map event to user", {
        eventId: event.id,
        type: event.type,
        hasCustomer: Boolean(customerId),
      });
      return {
        ok: false,
        code: "USER_NOT_FOUND",
        error: "Cannot map Stripe customer to user",
      };
    }

    if (event.type === "customer.subscription.deleted") {
      await revokeToFree({
        userId,
        stripeEventId: event.id,
        eventType: event.type,
      });
      return { ok: true };
    }

    if (event.type === "invoice.payment_failed") {
      await insertLedger({
        userId,
        kind: "adjust",
        centsDelta: 0,
        stripeEventId: event.id,
        bufferRemainingAfter: null,
        meta: { eventType: event.type, note: "payment_failed_no_grant" },
      });
      return { ok: true };
    }

    let priceId = extractPriceId(obj);
    let period = extractPeriod(obj);
    const billingInterval = extractBillingInterval(obj);
    const subscriptionId = extractSubscriptionId(obj);

    if (!priceId) {
      const meta = obj.metadata as Record<string, unknown> | undefined;
      const planMeta = asString(meta?.plan);
      if (planMeta === "pro" || planMeta === "premium") {
        priceId = STRIPE_PRICE_IDS[planMeta];
      }
    }

    const plan = planFromPriceId(priceId, STRIPE_PRICE_IDS);
    if (!plan) {
      console.error("[stripe-webhook] unknown or missing price id", {
        eventId: event.id,
        type: event.type,
      });
      return {
        ok: false,
        code: "UNKNOWN_PRICE",
        error: "Event does not map to a known Pro/Premium price",
      };
    }

    if (
      !asNumber(obj.current_period_start) &&
      !asNumber(obj.current_period_end)
    ) {
      const start = new Date();
      period = { start, end: new Date(start.getTime() + DEFAULT_PERIOD_MS) };
    }

    await grantPaidPlan({
      userId,
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      periodStart: period.start,
      periodEnd: period.end,
      billingInterval,
      stripeEventId: event.id,
      eventType: event.type,
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("usage_ledger_stripe_event_uidx") ||
      msg.includes("duplicate key") ||
      msg.includes("unique")
    ) {
      return { ok: true };
    }
    console.error("[stripe-webhook] settle failed", {
      eventId: event.id,
      type: event.type,
      name: err instanceof Error ? err.name : "unknown",
    });
    return {
      ok: false,
      code: "SETTLE_FAILED",
      error: "Failed to settle Stripe event",
    };
  }
}

export type { StripeEvent };
