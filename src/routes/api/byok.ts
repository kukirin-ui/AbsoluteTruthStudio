/**
 * BYOK credential CRUD (Auth owns).
 * POST / GET / DELETE /api/byok
 * Session auth only — never trust body.userId.
 * Responses never include ciphertext or plaintext secrets.
 * Error shape: { error, code, details }.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveBillingUserId } from "@/lib/auth/scale-contract";
import {
  ByokNotConfiguredError,
  deleteByokCredential,
  isByokProvider,
  listByokCredentialMeta,
  upsertByokCredential,
  type ByokProvider,
} from "@/lib/auth/byok-credentials.server";
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

function parseProvider(value: unknown): ByokProvider | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return isByokProvider(trimmed) ? trimmed : null;
}

export const Route = createFileRoute("/api/byok")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sessionUserId = await requireUserId();
          const userId = resolveBillingUserId(sessionUserId);
          const credentials = await listByokCredentialMeta(userId);
          return Response.json({ credentials });
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          if (
            message.includes("Auth is disabled") &&
            message.includes("DATABASE_URL")
          ) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[byok] GET unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },

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

          const provider = parseProvider(body.provider);
          if (!provider) {
            return jsonError(
              400,
              "provider must be openai, anthropic, or xai",
              "VALIDATION",
              { field: "provider" },
            );
          }

          const secret =
            typeof body.secret === "string"
              ? body.secret
              : typeof body.plaintext === "string"
                ? body.plaintext
                : "";
          if (!secret.trim()) {
            return jsonError(400, "secret must be a non-empty string", "VALIDATION", {
              field: "secret",
            });
          }

          const label =
            typeof body.label === "string" ? body.label : null;

          const meta = await upsertByokCredential({
            userId,
            provider,
            plaintext: secret,
            label,
          });

          return Response.json(meta);
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          if (err instanceof ByokNotConfiguredError) {
            return jsonError(503, err.message, "BYOK_NOT_CONFIGURED");
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          if (
            message.includes("Auth is disabled") &&
            message.includes("DATABASE_URL")
          ) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[byok] POST unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },

      DELETE: async ({ request }) => {
        try {
          let body: Record<string, unknown> = {};
          try {
            const text = await request.text();
            if (text.trim()) {
              body = JSON.parse(text) as Record<string, unknown>;
            }
          } catch {
            body = {};
          }

          const url = new URL(request.url);
          const queryProvider = url.searchParams.get("provider");

          const bodyUserId =
            typeof body.userId === "string" ? body.userId : null;
          const sessionUserId = await requireUserId();
          const userId = resolveBillingUserId(sessionUserId, bodyUserId);

          const provider = parseProvider(body.provider ?? queryProvider);
          if (!provider) {
            return jsonError(
              400,
              "provider must be openai, anthropic, or xai",
              "VALIDATION",
              { field: "provider" },
            );
          }

          const deleted = await deleteByokCredential(userId, provider);
          return Response.json({ deleted, provider });
        } catch (err) {
          if (err instanceof UnauthorizedError) {
            return jsonError(401, "Unauthorized", "UNAUTHORIZED");
          }
          const message =
            err instanceof Error ? err.message : "Internal server error";
          if (
            message.includes("Auth is disabled") &&
            message.includes("DATABASE_URL")
          ) {
            return jsonError(503, message, "AUTH_MISCONFIGURED");
          }
          console.error("[byok] DELETE unexpected error", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }
      },
    },
  },
});
