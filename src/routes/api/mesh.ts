import { createFileRoute } from "@tanstack/react-router";
import { buildSystemPrompt } from "@/lib/mesh";
import type { AgentId } from "@/lib/types";
import { normalizeAttachments, normalizeRoster, type Attachments, type Roster } from "@/lib/catalog";
import { resolveBillingUserId } from "@/lib/auth/scale-contract";
import {
  UnauthorizedError,
  requireUserId,
} from "@/lib/auth/verify.server";
import {
  MeshPaymentRequiredError,
  MESH_STUDIO_TURN_CENTS,
  assertMeshFunding,
} from "@/lib/billing/mesh-gate.server";
import { InsufficientBufferError, debitMeter } from "@/lib/billing/meter.server";

type Incoming = {
  mode?: string;
  plan?: string;
  intent?: string;
  duration?: number;
  specCompiler?: boolean;
  deepAudit?: boolean;
  memory?: Partial<Record<AgentId, string>>;
  roster?: Partial<Roster>;
  attachments?: Partial<Attachments>;
  messages?: { role?: string; content?: string }[];
  /** Ignored — session identity only (IDOR guard). */
  userId?: string;
};

function clampMessages(raw: Incoming["messages"]) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content!.slice(0, 8000),
    }));
}

function clampMemory(raw: Incoming["memory"]) {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const key of ["architect", "visual", "coder", "security"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.slice(0, 4000);
  }
  return Object.keys(out).length ? out : undefined;
}

function jsonError(
  status: number,
  error: string,
  code: string,
  details: unknown = null,
) {
  return Response.json({ error, code, details }, { status });
}

export const Route = createFileRoute("/api/mesh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Incoming;
        try {
          body = (await request.json()) as Incoming;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const mode = body.mode === "build" ? "build" : "talk";
        const plan = body.plan === "premium" || body.plan === "pro" ? body.plan : "free";
        const intent =
          body.intent === "image" || body.intent === "video" || body.intent === "app" ? body.intent : "text";
        const messages = clampMessages(body.messages);
        if (messages.length === 0) {
          return Response.json({ error: "Message required" }, { status: 400 });
        }

        // Session identity only — never trust body.userId (mirror meter routes).
        // Auth-off + no DATABASE_URL → DEV_USER_ID; funding check still applies.
        // Auth-off + DATABASE_URL → requireUserId fails closed (AUTH_MISCONFIGURED).
        let userId: string;
        try {
          const sessionUserId = await requireUserId();
          const bodyUserId =
            typeof body.userId === "string" ? body.userId : null;
          userId = resolveBillingUserId(sessionUserId, bodyUserId);
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
          console.error("[mesh] auth resolve failed", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }

        // Hard-stop unpaid: credits=0 AND no xAI BYOK → 402 PAYMENT_REQUIRED.
        // Non-xAI BYOK alone does NOT fund owner-key mesh.
        let creditCents = 0;
        try {
          const funding = await assertMeshFunding(userId);
          creditCents = funding.creditCents;
        } catch (err) {
          if (err instanceof MeshPaymentRequiredError) {
            return jsonError(402, err.message, err.code, {
              creditCents: err.creditCents,
              hasByok: err.hasByok,
            });
          }
          console.error("[mesh] funding gate failed", {
            name: err instanceof Error ? err.name : "unknown",
          });
          return jsonError(500, "Internal server error", "INTERNAL_ERROR");
        }

        // Key resolution (never log plaintext keys):
        // - creditCents > 0 → debitMeter then owner XAI_API_KEY (studio path)
        // - else → BYOK-only: successful decryptByokForAdapter(userId, "xai")
        //   NEVER fall back to owner key on decrypt null / fail / BYOK_NOT_CONFIGURED
        let apiKey: string | null = null;

        if (creditCents > 0) {
          try {
            await debitMeter(userId, {
              cents: MESH_STUDIO_TURN_CENTS,
              provider: "xai",
              modelId: "grok-4.5",
              seat: null,
              meshRunId: null,
            });
          } catch (err) {
            if (err instanceof InsufficientBufferError) {
              return jsonError(402, err.message, "INSUFFICIENT_BUFFER", {
                requestedCents: err.requestedCents,
                bufferCentsRemaining: err.bufferCentsRemaining,
                creditCents: err.creditCents,
              });
            }
            console.error("[mesh] debitMeter failed", {
              name: err instanceof Error ? err.name : "unknown",
            });
            return jsonError(500, "Internal server error", "INTERNAL_ERROR");
          }

          apiKey = process.env.XAI_API_KEY ?? null;
          if (!apiKey) {
            return Response.json(
              { error: "AI is not available in this environment." },
              { status: 503 },
            );
          }
        } else {
          const {
            decryptByokForAdapter,
            ByokNotConfiguredError,
            ByokDecryptError,
          } = await import("@/lib/auth/byok-credentials.server");
          try {
            apiKey = await decryptByokForAdapter(userId, "xai");
            if (!apiKey) {
              return jsonError(
                402,
                "Payment required: add credits or connect an xAI BYOK key",
                "PAYMENT_REQUIRED",
                { creditCents: 0, hasByokXai: false },
              );
            }
          } catch (err) {
            if (err instanceof ByokNotConfiguredError) {
              return jsonError(503, err.message, "BYOK_NOT_CONFIGURED");
            }
            // Decrypt fail → 402/503; NEVER owner-key fallback
            if (err instanceof ByokDecryptError) {
              console.error("[mesh] BYOK decrypt failed", {
                name: err.name,
              });
              return jsonError(
                402,
                "Payment required: add credits or reconnect xAI BYOK",
                "PAYMENT_REQUIRED",
                { creditCents: 0, hasByokXai: true },
              );
            }
            console.error("[mesh] BYOK resolve failed", {
              name: err instanceof Error ? err.name : "unknown",
            });
            return jsonError(
              402,
              "Payment required: add credits or connect an xAI BYOK key",
              "PAYMENT_REQUIRED",
              { creditCents: 0 },
            );
          }
        }

        const duration =
          typeof body.duration === "number" && body.duration > 0 ? Math.min(60, Math.round(body.duration)) : undefined;

        const roster = normalizeRoster(body.roster);
        const attachments = normalizeAttachments(body.attachments);
        const kling = plan === "premium" || roster.visual === "kling" || roster.visual === "kling-pro";
        const priority = (attachments.architect ?? []).includes("priority-mesh");

        const maxTokens =
          intent === "app" || mode === "build"
            ? 5200
            : plan === "premium" || priority
              ? 3600
              : intent === "video" || intent === "image"
                ? 1800
                : plan === "pro"
                  ? 1400
                  : 700;

        const xai = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
            stream: true,
            temperature: 0.2,
            max_tokens: maxTokens,
            messages: [
              {
                role: "system",
                content: buildSystemPrompt(mode, plan, {
                  intent,
                  duration,
                  specCompiler: Boolean(body.specCompiler),
                  deepAudit: Boolean(body.deepAudit),
                  memory: clampMemory(body.memory),
                  kling,
                  roster,
                  attachments,
                }),
              },
              ...messages,
            ],
          }),
        });

        if (!xai.ok || !xai.body) {
          if (xai.status === 401 || xai.status === 403 || xai.status === 429) {
            return Response.json(
              {
                error:
                  "The neural mesh is at capacity right now. Your session stays on this device — retry in a moment.",
              },
              { status: 503 },
            );
          }
          return Response.json(
            { error: "AI is not available right now. Local chats and exports still work." },
            { status: 502 },
          );
        }

        return new Response(xai.body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
