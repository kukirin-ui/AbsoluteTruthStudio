/**
 * Multi-provider routing for the mesh (server-only logic, but pure/testable).
 *
 * The studio runs one streaming completion that plays the four seats in lockstep.
 * This module decides WHICH real frontier provider that completion runs on, based
 * on the seated lead (Architect) model, and resolves the owner key + API model
 * string + endpoint for it.
 *
 * Safety contract: a provider is only "routable" when BOTH its owner key AND an
 * explicit model string are present. We never guess a model id (a wrong guess
 * would 400 on the provider). When a provider is not routable, callers MUST fall
 * back to the xAI/grok path that already works — so the live mesh never breaks.
 *
 * The exact model string per provider is read from env (e.g. MESH_MODEL_OPENAI),
 * so the owner updates to the newest frontier model in Vercel with no code change.
 */

export type MeshProvider = "xai" | "openai" | "anthropic" | "google";

export const MESH_PROVIDERS: readonly MeshProvider[] = [
  "xai",
  "openai",
  "anthropic",
  "google",
] as const;

export type OutputPower = "low" | "mid" | "max";

/** Map a catalog agent id (or brand) that can sit the lead seat to its provider. */
export function providerForAgentId(agentId: string): MeshProvider {
  const id = String(agentId || "").toLowerCase();
  if (id.includes("claude")) return "anthropic";
  if (id.includes("gpt") || id.includes("chatgpt") || id.includes("openai")) return "openai";
  if (id.includes("gemini") || id.includes("google")) return "google";
  // grok, grok-architect, llama/mistral/deepseek/qwen (routed via xAI-compatible), default
  return "xai";
}

/** Candidate env var names for a provider's owner key, most specific first. */
export function ownerKeyEnvNames(provider: MeshProvider): string[] {
  switch (provider) {
    case "xai":
      return ["XAI_API_KEY", "GROK_API_KEY"];
    case "openai":
      return ["OPENAI_API_KEY", "CHATGPT_API_KEY"];
    case "anthropic":
      return ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"];
    case "google":
      return ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
  }
}

/** Resolve a provider's owner key from an env bag, trying flexible names. */
export function resolveOwnerKey(
  provider: MeshProvider,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  for (const name of ownerKeyEnvNames(provider)) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

/** Env var that pins the exact API model string per provider (owner-updatable). */
export function modelEnvName(provider: MeshProvider): string {
  return `MESH_MODEL_${provider.toUpperCase()}`;
}

/**
 * Resolve the API model string. xAI keeps a known default (grok-4.5); every other
 * provider requires an explicit MESH_MODEL_* so we never call with a guessed id.
 */
export function resolveModel(
  provider: MeshProvider,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const pinned = env[modelEnvName(provider)]?.trim();
  if (pinned) return pinned;
  if (provider === "xai") return "grok-4.5";
  return undefined;
}

/** xAI, OpenAI, and Google (via its OpenAI-compat endpoint) all speak the same SSE. */
export function isOpenAiCompatible(provider: MeshProvider): boolean {
  return provider !== "anthropic";
}

export function chatEndpoint(provider: MeshProvider): string {
  switch (provider) {
    case "xai":
      return "https://api.x.ai/v1/chat/completions";
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "google":
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
  }
}

/** Output power → sampling params. Same shape everywhere; callers cap max_tokens. */
export function powerParams(power: OutputPower): { temperature: number } {
  switch (power) {
    case "low":
      return { temperature: 0.1 };
    case "max":
      return { temperature: 0.5 };
    case "mid":
    default:
      return { temperature: 0.2 };
  }
}

export type ChatRequest = {
  provider: MeshProvider;
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  temperature: number;
};

/** Build the concrete fetch inputs for a provider (OpenAI-compat or Anthropic). */
export function buildChatFetch(req: ChatRequest): {
  url: string;
  headers: Record<string, string>;
  body: string;
} {
  const url = chatEndpoint(req.provider);
  if (req.provider === "anthropic") {
    return {
      url,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.model,
        stream: true,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    };
  }
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      messages: [{ role: "system", content: req.system }, ...req.messages],
    }),
  };
}

/**
 * Translate a single Anthropic SSE payload line into an OpenAI-compatible
 * `data: {choices:[{delta:{content}}]}` chunk the studio frontend already parses,
 * or null when the line carries no visible text. Pure, so it is unit-tested.
 *
 * `raw` is the JSON string after `data: ` from an Anthropic stream event.
 */
export function anthropicDataToOpenAi(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[DONE]") return null;
  let evt: unknown;
  try {
    evt = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const e = evt as {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
    const text = e.delta.text ?? "";
    if (!text) return null;
    return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
  }
  return null;
}

export type LeadRouting =
  | { kind: "provider"; provider: MeshProvider; model: string; apiKey: string }
  | { kind: "fallback"; reason: string };

/**
 * Decide how to run this turn given the seated lead agent and available owner
 * keys. Returns a concrete provider route when the selected provider has both a
 * key and a pinned model; otherwise a fallback signal (caller runs the xAI path).
 * `xaiKey` is the already-resolved key for the guaranteed fallback path.
 */
export function resolveLeadRouting(
  leadAgentId: string,
  env: Record<string, string | undefined> = process.env,
): LeadRouting {
  const provider = providerForAgentId(leadAgentId);
  if (provider === "xai") return { kind: "fallback", reason: "lead is xAI" };
  const apiKey = resolveOwnerKey(provider, env);
  if (!apiKey) return { kind: "fallback", reason: `no owner key for ${provider}` };
  const model = resolveModel(provider, env);
  if (!model) return { kind: "fallback", reason: `no ${modelEnvName(provider)} set` };
  return { kind: "provider", provider, model, apiKey };
}
