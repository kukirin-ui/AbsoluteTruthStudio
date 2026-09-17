/**
 * Absolute source of truth for model availability.
 *
 * Plan ceiling is the only gate. BYOK does not raise it — a personal key only
 * changes who pays for the call. Owners bypass the ceiling.
 */
import type { AgentId, PlanId } from "./types.ts";

export type PlanTier = "basic" | "standard" | "high" | "max";
export type AgentRole = "architecture" | "visual" | "coder" | "verifier";
export type MeshProviderId = "anthropic" | "openai" | "google" | "xai" | "mistral" | "deepseek" | "qwen" | "meta";

export interface ModelDefinition {
  id: string;
  name: string;
  tier: PlanTier;
  provider: string;
}

export interface UserContext {
  isOwner: boolean;
  plan: PlanTier;
}

export interface SeatState {
  role: AgentRole;
  selectedModelId: string;
  hasBYOK: boolean;
  byokProvider?: string;
}

export type AllowedModelResult = {
  allowedModelId: string;
  wasClamped: boolean;
  reason?: string;
};

export const TIER_HIERARCHY: readonly PlanTier[] = ["basic", "standard", "high", "max"];

/** UI ladder order — flagship first. */
export const DISPLAY_TIER_ORDER: readonly PlanTier[] = ["max", "high", "standard", "basic"];

export const ROLE_TO_SEAT: Record<AgentRole, AgentId> = {
  architecture: "architect",
  visual: "visual",
  coder: "coder",
  verifier: "security",
};

export const SEAT_TO_ROLE: Record<AgentId, AgentRole> = {
  architect: "architecture",
  visual: "visual",
  coder: "coder",
  security: "verifier",
};

export const CATALOG_PROVIDER_LABEL: Record<MeshProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Alibaba",
  meta: "Meta",
};

/**
 * Catalog of call-able mesh models. Keys are the exact API model ids.
 * When the same id is listed at two plan tiers (xAI high = max today), the
 * entry uses the lowest tier so anyone whose ceiling includes that model can
 * run it.
 */
export const MODEL_CATALOG: Record<string, ModelDefinition> = {
  "claude-haiku-4-5": { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", tier: "basic", provider: "Anthropic" },
  "gpt-5.6-luna": { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", tier: "basic", provider: "OpenAI" },
  "gemini-3.1-flash-lite": { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite", tier: "basic", provider: "Google" },
  "grok-4-fast": { id: "grok-4-fast", name: "Grok 4 Fast", tier: "basic", provider: "xAI" },
  "claude-sonnet-5": { id: "claude-sonnet-5", name: "Claude Sonnet 5", tier: "standard", provider: "Anthropic" },
  "gpt-5.6-terra": { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", tier: "standard", provider: "OpenAI" },
  "gemini-3.7-flash": { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", tier: "standard", provider: "Google" },
  "grok-4.5": { id: "grok-4.5", name: "Grok 4.5", tier: "standard", provider: "xAI" },
  "claude-opus-5": { id: "claude-opus-5", name: "Claude Opus 5", tier: "high", provider: "Anthropic" },
  "gpt-5.6-sol": { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", tier: "high", provider: "OpenAI" },
  "gemini-3.8-flash": { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", tier: "high", provider: "Google" },
  "grok-4.6": { id: "grok-4.6", name: "Grok 4.6", tier: "high", provider: "xAI" },
  "claude-fable-5-1": { id: "claude-fable-5-1", name: "Claude Fable 5.1", tier: "max", provider: "Anthropic" },
  "gpt-6-astra": { id: "gpt-6-astra", name: "GPT-6 Astra", tier: "max", provider: "OpenAI" },
  "gemini-3-pro": { id: "gemini-3-pro", name: "Gemini 3 Pro", tier: "max", provider: "Google" },
  "mistral-small-latest": { id: "mistral-small-latest", name: "Mistral Small", tier: "basic", provider: "Mistral" },
  "mistral-medium-latest": { id: "mistral-medium-latest", name: "Mistral Medium", tier: "standard", provider: "Mistral" },
  "mistral-large-latest": { id: "mistral-large-latest", name: "Mistral Large", tier: "high", provider: "Mistral" },
  "magistral-medium-latest": { id: "magistral-medium-latest", name: "Magistral Medium", tier: "max", provider: "Mistral" },
  "deepseek-chat": { id: "deepseek-chat", name: "DeepSeek V3 (Chat)", tier: "basic", provider: "DeepSeek" },
  "deepseek-reasoner": { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoner)", tier: "high", provider: "DeepSeek" },
  "qwen3.7-flash": { id: "qwen3.7-flash", name: "Qwen3.7 Flash", tier: "basic", provider: "Alibaba" },
  "qwen3.7-plus": { id: "qwen3.7-plus", name: "Qwen3.7 Plus", tier: "standard", provider: "Alibaba" },
  "qwen3.8-flash": { id: "qwen3.8-flash", name: "Qwen3.8 Flash", tier: "high", provider: "Alibaba" },
  "qwen3.8-max": { id: "qwen3.8-max", name: "Qwen3.8 Max", tier: "max", provider: "Alibaba" },
  "muse-spark-1.1": { id: "muse-spark-1.1", name: "Muse Spark 1.1", tier: "basic", provider: "Meta" },
  "muse-spark-1.3": { id: "muse-spark-1.3", name: "Muse Spark 1.3", tier: "high", provider: "Meta" },
};

const FALLBACK_MODEL = MODEL_CATALOG["claude-haiku-4-5"]!;

export function tierRank(tier: PlanTier): number {
  return TIER_HIERARCHY.indexOf(tier);
}

/** Map a billed plan onto the ceiling the engine enforces. */
export function ceilingForPlan(plan: PlanId): PlanTier {
  if (plan === "premium") return "max";
  if (plan === "pro") return "high";
  return "basic";
}

export function userContextForPlan(plan: PlanId, isOwner: boolean): UserContext {
  return { isOwner, plan: ceilingForPlan(plan) };
}

export function clampReason(plan: PlanTier): string {
  return `Your ${plan} plan restricts usage to ${plan} tier models, even when using a personal API key.`;
}

function fallbackForCeiling(ceiling: PlanTier, preferredProvider?: string): ModelDefinition {
  const atCeiling = Object.values(MODEL_CATALOG).filter((m) => m.tier === ceiling);
  const sameProvider = preferredProvider
    ? atCeiling.find((m) => m.provider === preferredProvider)
    : undefined;
  return sameProvider ?? atCeiling[0] ?? FALLBACK_MODEL;
}

/**
 * Resolves the final model ID based on strict plan ceilings.
 * BYOK does NOT bypass the plan ceiling. It only changes the funding source.
 * SeatState.hasBYOK is ignored here on purpose.
 */
export function resolveAllowedModel(
  requestedModelId: string,
  user: UserContext,
): AllowedModelResult {
  if (user.isOwner) {
    return { allowedModelId: requestedModelId, wasClamped: false };
  }

  const requestedModel = MODEL_CATALOG[requestedModelId];
  if (!requestedModel) {
    throw new Error(`Unknown model requested: ${requestedModelId}`);
  }

  const requestedIndex = tierRank(requestedModel.tier);
  const ceilingIndex = tierRank(user.plan);

  if (requestedIndex > ceilingIndex) {
    const fallbackModel = fallbackForCeiling(user.plan, requestedModel.provider);
    return {
      allowedModelId: fallbackModel.id,
      wasClamped: true,
      reason: clampReason(user.plan),
    };
  }

  return { allowedModelId: requestedModelId, wasClamped: false };
}

/**
 * Per-seat resolution. hasBYOK / byokProvider never affect the allowed model.
 */
export function resolveSeatModel(seat: SeatState, user: UserContext): AllowedModelResult {
  return resolveAllowedModel(seat.selectedModelId, user);
}

export function catalogModel(id: string): ModelDefinition | undefined {
  return MODEL_CATALOG[id];
}

export function isTierUnlocked(tier: PlanTier, user: UserContext): boolean {
  return user.isOwner || tierRank(tier) <= tierRank(user.plan);
}

export function modelsInTier(tier: PlanTier): ModelDefinition[] {
  return Object.values(MODEL_CATALOG).filter((m) => m.tier === tier);
}

export function meshProviderId(provider: string): MeshProviderId {
  const p = provider.trim().toLowerCase();
  if (p === "anthropic") return "anthropic";
  if (p === "openai") return "openai";
  if (p === "google") return "google";
  if (p === "mistral") return "mistral";
  if (p === "deepseek") return "deepseek";
  if (p === "alibaba" || p === "qwen") return "qwen";
  if (p === "meta" || p === "llama") return "meta";
  return "xai";
}

export function catalogProviderLabel(provider: MeshProviderId): string {
  return CATALOG_PROVIDER_LABEL[provider];
}

/** Highest model this user may run for a catalog provider label (Anthropic, …). */
export function highestAllowedModel(
  providerLabel: string,
  user: UserContext,
): ModelDefinition {
  const ceiling = user.isOwner ? ("max" as PlanTier) : user.plan;
  const candidates = Object.values(MODEL_CATALOG).filter((m) => m.provider === providerLabel);
  const allowed = candidates.filter((m) => tierRank(m.tier) <= tierRank(ceiling));
  allowed.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
  return allowed[0] ?? fallbackForCeiling(user.isOwner ? "max" : user.plan, providerLabel);
}

/**
 * Stored id (or null = auto) → engine-resolved id for this seat's seated provider.
 */
export function effectiveSeatModelId(
  selectedModelId: string | null | undefined,
  user: UserContext,
  providerLabel: string,
): AllowedModelResult {
  if (!selectedModelId) {
    const auto = highestAllowedModel(providerLabel, user);
    return { allowedModelId: auto.id, wasClamped: false };
  }
  try {
    return resolveAllowedModel(selectedModelId, user);
  } catch {
    const auto = highestAllowedModel(providerLabel, user);
    return {
      allowedModelId: auto.id,
      wasClamped: true,
      reason: clampReason(user.plan),
    };
  }
}

/** Resolve a seat's live model from an explicit id, a stored tier, or plan auto. */
export function resolvedSeatModelId(
  selectedModelId: string | null | undefined,
  selectedTier: PlanTier | null | undefined,
  user: UserContext,
  providerLabel: string,
): string {
  if (selectedModelId) {
    return effectiveSeatModelId(selectedModelId, user, providerLabel).allowedModelId;
  }
  if (selectedTier) {
    const candidates = Object.values(MODEL_CATALOG).filter((m) => m.provider === providerLabel);
    const exact = candidates.find((m) => m.tier === selectedTier);
    const fallback =
      exact ??
      candidates
        .filter((m) => tierRank(m.tier) <= tierRank(selectedTier))
        .sort((a, b) => tierRank(b.tier) - tierRank(a.tier))[0];
    if (fallback) {
      try {
        return resolveAllowedModel(fallback.id, user).allowedModelId;
      } catch {
        /* fall through */
      }
    }
  }
  return highestAllowedModel(providerLabel, user).id;
}

export type SeatModelMap = Record<AgentId, string | null>;

export function clampStoredSeatModels(models: SeatModelMap, user: UserContext): SeatModelMap {
  const next: SeatModelMap = { ...models };
  for (const seat of Object.keys(next) as AgentId[]) {
    const id = next[seat];
    if (!id) continue;
    try {
      const resolved = resolveAllowedModel(id, user);
      next[seat] = resolved.allowedModelId;
    } catch {
      next[seat] = null;
    }
  }
  return next;
}
