/**
 * Absolute source of truth for model availability.
 *
 * Plan ceiling is the only gate. BYOK does not raise it — a personal key only
 * changes who pays for the call. Owners bypass the ceiling.
 */
import type { PlanId } from "./types.ts";

export type PlanTier = "basic" | "standard" | "high" | "max";
export type AgentRole = "architecture" | "visual" | "coder" | "verifier";

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
