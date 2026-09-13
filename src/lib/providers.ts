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

/** How to get the best out of each model — shown when you open an agent. */
export const PROVIDER_GUIDE: Record<MeshProvider, { title: string; tips: string[] }> = {
  anthropic: {
    title: "Prompting Claude",
    tips: [
      "State the constraints and the shape of the answer up front.",
      "Ask for a plan or spec before any code.",
      "Define what 'done' looks like — it reasons hardest with a clear target.",
    ],
  },
  openai: {
    title: "Prompting GPT",
    tips: [
      "Be explicit about the output format you want back.",
      "Strong on step-by-step and typed tool/function tasks.",
      "Ask for surgical diffs on existing code, not full rewrites.",
    ],
  },
  google: {
    title: "Prompting Gemini",
    tips: [
      "Attach the image or video — it grounds the brief on what it sees.",
      "Best when the brief is visual from the first line.",
      "Ask it to generate or edit a still in-line.",
    ],
  },
  xai: {
    title: "Prompting Grok",
    tips: [
      "Ask it to check claims against live X and the web.",
      "Direct and current — name exactly what to verify.",
      "Best for real-time facts and fresh sources.",
    ],
  },
};

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
 * Highest-tier default model per provider (current flagships as of 2026-09).
 * Override any of these live via MESH_MODEL_* in Vercel — that env value is the
 * "update the model any day" lever, no code change needed.
 *   - anthropic: claude-fable-5-1 is even higher but slower/pricier — set the env to it if wanted.
 *   - openai: set MESH_MODEL_OPENAI=gpt-5.6 if the org lacks GPT-6 Astra access.
 */
export const DEFAULT_MODEL: Record<MeshProvider, string> = {
  xai: "grok-4.6",
  anthropic: "claude-opus-5",
  openai: "gpt-6-astra",
  google: "gemini-3.8-flash",
};

/** Resolve the API model string: an owner-pinned MESH_MODEL_*, else the flagship default. */
export function resolveModel(
  provider: MeshProvider,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const pinned = env[modelEnvName(provider)]?.trim();
  if (pinned) return pinned;
  return DEFAULT_MODEL[provider];
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
    // Opus 5 / Fable 5.1 run extended thinking on by default, which rejects a
    // non-default temperature — so omit temperature entirely.
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
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    };
  }
  const payload: Record<string, unknown> = {
    model: req.model,
    stream: true,
    messages: [{ role: "system", content: req.system }, ...req.messages],
  };
  if (req.provider === "openai") {
    // GPT-5.6/6 reasoning models use max_completion_tokens and reject temperature.
    payload.max_completion_tokens = req.maxTokens;
  } else if (req.provider === "google") {
    // Gemini 3.x deprecates classic sampling params; send only the token cap.
    payload.max_tokens = req.maxTokens;
  } else {
    // xAI keeps the classic sampling knobs, so power maps to temperature here.
    payload.max_tokens = req.maxTokens;
    payload.temperature = req.temperature;
  }
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(payload),
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
