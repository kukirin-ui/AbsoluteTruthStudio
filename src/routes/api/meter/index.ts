/**
 * GET /api/meter
 *
 * Returns the signed-in user's buffer meter snapshot.
 * Authz: session only — never trust body.userId.
 */
import { createFileRoute } from "@tanstack/react-router";
import { getMeter } from "@/lib/billing/meter.server";
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

export const Route = createFileRoute("/api/meter/")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const userId = await requireUserId();
          const meter = await getMeter(userId);
          return Response.json(meter);
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          if (message.includes("Auth is disabled") && message.includes("DATABASE_URL")) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[meter] unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },
    },
  },
});
