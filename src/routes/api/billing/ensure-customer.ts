/**
 * POST /api/billing/ensure-customer
 *
 * Ensures a Stripe Customer for the signed-in Better Auth user and persists
 * entitlements.stripe_customer_id. Call before Checkout.
 *
 * Authz: session user only — never trust body.userId (IDOR).
 * Error shape: { error, code, details }.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  StripeApiError,
  StripeNotConfiguredError,
  ensureStripeCustomer,
  getEntitlementPlan,
} from "@/lib/auth/entitlements.server";
import { resolveBillingUserId } from "@/lib/auth/scale-contract";
import {
  UnauthorizedError,
  getSessionUser,
  requireUserId,
} from "@/lib/auth/verify.server";

function jsonError(
  status: number,
  error: string,
  code: string,
  details: unknown = null,
) {
  return Response.json({ error, code, details }, { status });
}

export const Route = createFileRoute("/api/billing/ensure-customer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Parse body only to discard spoofed userId — never use it for authz.
          let bodyUserId: string | null = null;
          try {
            const body = (await request.json()) as { userId?: unknown };
            if (typeof body?.userId === "string") bodyUserId = body.userId;
          } catch {
            // Empty / non-JSON body is fine.
          }

          const sessionUserId = await requireUserId();
          const userId = resolveBillingUserId(sessionUserId, bodyUserId);
          const session = await getSessionUser();
          const email = session?.email ?? null;

          const { stripeCustomerId } = await ensureStripeCustomer(userId, email);
          const plan = await getEntitlementPlan(userId);

          return Response.json({ userId, stripeCustomerId, plan });
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          if (err instanceof StripeNotConfiguredError) {
            return jsonError(503, "Stripe is not configured", "STRIPE_NOT_CONFIGURED");
          }
          if (err instanceof StripeApiError) {
            return jsonError(err.status, err.message, err.code, {
              stripeType: err.stripeType ?? null,
            });
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          // Fail-closed auth-disabled + DATABASE_URL surfaces as a plain Error.
          if (message.includes("Auth is disabled") && message.includes("DATABASE_URL")) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[ensure-customer] unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },
    },
  },
});
