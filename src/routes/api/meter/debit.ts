/**
 * POST /api/meter/debit
 *
 * Debit credits first (then any residual buffer) for mesh usage.
 * Authz: session only — body.userId is ignored via resolveBillingUserId.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveBillingUserId } from "@/lib/auth/scale-contract";
import {
  InsufficientBufferError,
  debitMeter,
} from "@/lib/billing/meter.server";
import {
  UnauthorizedError,
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

export const Route = createFileRoute("/api/meter/debit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: Record<string, unknown> = {};
          try {
            body = (await request.json()) as Record<string, unknown>;
          } catch {
            body = {};
          }

          const bodyUserId =
            typeof body.userId === "string" ? body.userId : null;

          const sessionUserId = await requireUserId();
          const userId = resolveBillingUserId(sessionUserId, bodyUserId);

          const centsRaw = body.cents;
          const cents =
            typeof centsRaw === "number"
              ? centsRaw
              : typeof centsRaw === "string"
                ? Number(centsRaw)
                : NaN;

          if (!Number.isFinite(cents) || cents <= 0 || !Number.isInteger(cents)) {
            return jsonError(
              400,
              "cents must be a positive integer",
              "VALIDATION",
              { field: "cents" },
            );
          }

          const result = await debitMeter(userId, {
            cents,
            seat: typeof body.seat === "string" ? body.seat : null,
            provider: typeof body.provider === "string" ? body.provider : null,
            modelId: typeof body.modelId === "string" ? body.modelId : null,
            meshRunId:
              typeof body.meshRunId === "string" ? body.meshRunId : null,
            tokensIn:
              typeof body.tokensIn === "number" ? body.tokensIn : null,
            tokensOut:
              typeof body.tokensOut === "number" ? body.tokensOut : null,
          });

          return Response.json(result);
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          if (err instanceof InsufficientBufferError) {
            return jsonError(402, err.message, "INSUFFICIENT_BUFFER", {
              requestedCents: err.requestedCents,
              bufferCentsRemaining: err.bufferCentsRemaining,
              creditCents: err.creditCents,
            });
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          if (message.includes("Auth is disabled") && message.includes("DATABASE_URL")) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[meter/debit] unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },
    },
  },
});
