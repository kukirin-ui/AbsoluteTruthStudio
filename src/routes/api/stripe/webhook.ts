/**
 * POST /api/stripe/webhook
 *
 * Raw-body Stripe signature verify + settle allowlisted events.
 * Error shape: { error, code, details }.
 */
import { createFileRoute } from "@tanstack/react-router";
import { isScaleSettleEvent } from "@/lib/auth/scale-contract";
import {
  StripeSignatureError,
  settleStripeEvent,
  verifyStripeSignature,
} from "@/lib/billing/stripe-webhook.server";

function jsonError(
  status: number,
  error: string,
  code: string,
  details: unknown = null,
) {
  return Response.json({ error, code, details }, { status });
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
          if (!secret) {
            return jsonError(
              503,
              "Stripe webhook is not configured",
              "STRIPE_NOT_CONFIGURED",
            );
          }

          const rawBody = await request.text();
          const sigHeader =
            request.headers.get("stripe-signature") ??
            request.headers.get("Stripe-Signature");

          try {
            verifyStripeSignature(rawBody, sigHeader, secret);
          } catch (err) {
            if (err instanceof StripeSignatureError) {
              return jsonError(400, err.message, "BAD_SIGNATURE");
            }
            throw err;
          }

          let parsed: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
          try {
            parsed = JSON.parse(rawBody) as typeof parsed;
          } catch {
            return jsonError(400, "Invalid JSON body", "VALIDATION");
          }

          if (!parsed?.id || !parsed?.type) {
            return jsonError(400, "Invalid event shape", "VALIDATION");
          }

          if (!isScaleSettleEvent(parsed.type)) {
            return Response.json({ received: true, ignored: true });
          }

          const result = await settleStripeEvent({
            id: parsed.id,
            type: parsed.type,
            data: { object: parsed.data?.object ?? {} },
          });

          if (!result.ok) {
            return jsonError(422, result.error, result.code);
          }

          return Response.json({ received: true });
        } catch (err) {
          console.error("[stripe/webhook] unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },
    },
  },
});
