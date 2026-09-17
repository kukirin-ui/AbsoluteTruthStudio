/**
 * Auth Scale v1 — client-safe contract types/constants for Backend + Frontend.
 *
 * NO secrets. NO server imports (db, Stripe, Better Auth server).
 *
 * Premium / Pro grant is ONLY via webhook settle on SCALE_SETTLE_EVENTS.
 * Client Honor Activate and any client-claimed Premium without a settled
 * Stripe event MUST be rejected on the server grant path.
 */

/** Stripe events that may settle entitlements (Backend webhook owns handlers). */
export const SCALE_SETTLE_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export type ScaleSettleEvent = (typeof SCALE_SETTLE_EVENTS)[number];

export type AuthSessionUser = { id: string; email: string | null };

/** Better Auth session cookie (also accept Authorization: Bearer). */
export const SESSION_COOKIE_NAME = "__Host-ats-auth.session_token";

/**
 * IDOR guard for billing routes: identity comes ONLY from the verified session.
 * Any client-supplied body.userId is ignored even if present.
 */
export function resolveBillingUserId(
  sessionUserId: string,
  _clientBodyUserId?: string | null,
): string {
  return sessionUserId;
}

export function isScaleSettleEvent(value: string): value is ScaleSettleEvent {
  return (SCALE_SETTLE_EVENTS as readonly string[]).includes(value);
}
