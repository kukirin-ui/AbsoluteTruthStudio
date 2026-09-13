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
import {
  anthropicDataToOpenAi,
  buildChatFetch,
  powerParams,
  providerForAgentId,
  resolveLeadRouting,
  type OutputPower,
} from "@/lib/providers";
import { resolveMeshModel } from "@/lib/tiers";

type Incoming = {
  mode?: string;
  plan?: string;
  intent?: string;
  power?: string;
  tier?: string;
  duration?: number;
  specCompiler?: boolean;
  deepAudit?: boolean;
  memory?: Partial<Record<AgentId, string>>;
  roster?: Partial<Roster>;
  attachments?: Partial<Attachments>;
  activeSeats?: Partial<Record<AgentId, boolean>>;
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

/**
 * Re-encode an Anthropic Messages SSE stream as the OpenAI-style
 * `data: {choices:[{delta:{content}}]}` stream the studio frontend already
 * parses, so a Claude lead needs no client changes. Ends with `data: [DONE]`.
 */
function anthropicToOpenAiStream(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const converted = anthropicDataToOpenAi(line.slice(5));
          if (converted) controller.enqueue(encoder.encode(converted));
        }
      },
      flush(controller) {
        if (buffer.startsWith("data:")) {
          const converted = anthropicDataToOpenAi(buffer.slice(5));
          if (converted) controller.enqueue(encoder.encode(converted));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
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

        // Lead provider = who sits the Architect seat; it drives which real model
        // the run calls, which owner/BYOK key funds it, and the funding check.
        const roster = normalizeRoster(body.roster);
        const leadProvider = providerForAgentId(roster.architect);

        // Funded by credits OR the user's own BYOK key for the lead provider
        // (their own key for any model — including ones beyond the four seats).
        let creditCents = 0;
        try {
          const funding = await assertMeshFunding(userId, leadProvider);
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
          // BYOK path: use the user's own key for the lead provider — never an
          // owner key. Works for any provider (xai/openai/anthropic/google).
          const {
            decryptByokForAdapter,
            ByokNotConfiguredError,
            ByokDecryptError,
          } = await import("@/lib/auth/byok-credentials.server");
          try {
            apiKey = await decryptByokForAdapter(userId, leadProvider);
            if (!apiKey) {
              return jsonError(
                402,
                `Payment required: add credits or connect a ${leadProvider} BYOK key`,
                "PAYMENT_REQUIRED",
                { creditCents: 0, hasByokLead: false },
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
                `Payment required: add credits or reconnect your ${leadProvider} key`,
                "PAYMENT_REQUIRED",
                { creditCents: 0, hasByokLead: true },
              );
            }
            console.error("[mesh] BYOK resolve failed", {
              name: err instanceof Error ? err.name : "unknown",
            });
            return jsonError(
              402,
              "Payment required: add credits or connect a BYOK key",
              "PAYMENT_REQUIRED",
              { creditCents: 0 },
            );
          }
        }

        const duration =
          typeof body.duration === "number" && body.duration > 0 ? Math.min(60, Math.round(body.duration)) : undefined;

        const attachments = normalizeAttachments(body.attachments);
        const kling = plan === "premium" || roster.visual === "kling" || roster.visual === "kling-pro";
        const priority = (attachments.architect ?? []).includes("priority-mesh");
        const power: OutputPower =
          body.power === "low" || body.power === "max" ? body.power : "mid";
        const { temperature } = powerParams(power);

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

        const activeSeats =
          body.activeSeats && typeof body.activeSeats === "object"
            ? (["architect", "visual", "coder", "security"] as AgentId[]).reduce<
                Partial<Record<AgentId, boolean>>
              >((acc, seat) => {
                if (typeof body.activeSeats?.[seat] === "boolean") acc[seat] = body.activeSeats[seat];
                return acc;
              }, {})
            : undefined;

        const system = buildSystemPrompt(mode, plan, {
          intent,
          duration,
          specCompiler: Boolean(body.specCompiler),
          deepAudit: Boolean(body.deepAudit),
          memory: clampMemory(body.memory),
          kling,
          roster,
          attachments,
          activeSeats,
        });

        // Credits → owner keys resolved per provider (xAI fallback if the owner
        // has no key for that provider). BYOK → the user's own key for the lead
        // provider, routed straight to that provider (no owner-key fallback).
        const fundedByCredits = creditCents > 0;
        const routing = fundedByCredits
          ? resolveLeadRouting(roster.architect)
          : ({
              kind: "provider" as const,
              provider: leadProvider,
              model: resolveMeshModel(leadProvider, plan, body.tier),
              apiKey: (apiKey ?? "") as string,
            });

        // Per-plan tier → exact model id (Premium=highest, Pro=few-below, Free=basic;
        // a client-sent downgrade is clamped to the plan ceiling).
        const xaiModel = resolveMeshModel("xai", plan, body.tier);
        const xaiFallback = () => ({
          url: "https://api.x.ai/v1/chat/completions",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: xaiModel,
            stream: true,
            temperature,
            max_tokens: maxTokens,
            messages: [{ role: "system", content: system }, ...messages],
          }),
          translateAnthropic: false,
        });

        const req =
          routing.kind === "provider"
            ? {
                ...buildChatFetch({
                  provider: routing.provider,
                  apiKey: routing.apiKey,
                  model: resolveMeshModel(routing.provider, plan, body.tier),
                  system,
                  messages,
                  maxTokens,
                  temperature,
                }),
                translateAnthropic: routing.provider === "anthropic",
              }
            : xaiFallback();

        async function callUpstream(input: { url: string; headers: Record<string, string>; body: string }) {
          return fetch(input.url, { method: "POST", headers: input.headers, body: input.body });
        }

        let upstream: Response;
        try {
          upstream = await callUpstream(req);
        } catch {
          // A real-provider network failure must not kill the mesh — retry on the
          // owner xAI key, but only on the credits path (never reuse a BYOK key).
          if (fundedByCredits && routing.kind === "provider") {
            try {
              upstream = await callUpstream(xaiFallback());
            } catch {
              return Response.json(
                { error: "AI is not available right now. Local chats and exports still work." },
                { status: 502 },
              );
            }
          } else {
            return Response.json(
              { error: "AI is not available right now. Local chats and exports still work." },
              { status: 502 },
            );
          }
        }

        // A real-provider error (bad model/key/rate) also retries on the owner
        // xAI key — credits path only, so a BYOK key is never sent to xAI.
        if ((!upstream.ok || !upstream.body) && fundedByCredits && routing.kind === "provider") {
          const retry = await callUpstream(xaiFallback()).catch(() => null);
          if (retry && retry.ok && retry.body) {
            return new Response(retry.body, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
              },
            });
          }
        }

        if (!upstream.ok || !upstream.body) {
          if (upstream.status === 401 || upstream.status === 403 || upstream.status === 429) {
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

        const outBody =
          "translateAnthropic" in req && req.translateAnthropic
            ? anthropicToOpenAiStream(upstream.body)
            : upstream.body;

        return new Response(outBody, {
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
