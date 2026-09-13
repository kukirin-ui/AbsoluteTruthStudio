/**
 * Per-plan model tiers with EXACT provider model ids.
 *
 * Business rule:
 *   - Premium  → ceiling = "max" (the highest tier known today), default = max.
 *   - Pro      → ceiling = "high" (a few tiers below Premium, so Pro sees what
 *                Premium can do), default = high.
 *   - Free     → ceiling = "basic" only.
 * On every plan a seat may be downgraded to any tier at or below the ceiling.
 *
 * Any tier's model id is overridable live via MESH_MODEL_<PROVIDER> in Vercel
 * (that env value pins the model regardless of tier — the "update any day" lever).
 */
import type { MeshProvider } from "./providers";
import type { PlanId } from "./types";

/** Env var that pins the exact model per provider (kept in sync with providers.ts). */
function modelEnvName(provider: MeshProvider): string {
  return `MESH_MODEL_${provider.toUpperCase()}`;
}

export type ModelTier = "basic" | "standard" | "high" | "max";
export const TIER_ORDER: readonly ModelTier[] = ["basic", "standard", "high", "max"] as const;

export type TierEntry = { model: string; label: string };

/** Exact model id + display name per provider per tier (current as of 2026-09). */
export const PROVIDER_TIERS: Record<MeshProvider, Record<ModelTier, TierEntry>> = {
  anthropic: {
    basic: { model: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    standard: { model: "claude-sonnet-5", label: "Claude Sonnet 5" },
    high: { model: "claude-opus-5", label: "Claude Opus 5" },
    max: { model: "claude-fable-5-1", label: "Claude Fable 5.1" },
  },
  openai: {
    basic: { model: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    standard: { model: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    high: { model: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    max: { model: "gpt-6-astra", label: "GPT-6 Astra" },
  },
  google: {
    basic: { model: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
    standard: { model: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    high: { model: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
    max: { model: "gemini-3-pro", label: "Gemini 3 Pro" },
  },
  xai: {
    basic: { model: "grok-4-fast", label: "Grok 4 Fast" },
    standard: { model: "grok-4.5", label: "Grok 4.5" },
    high: { model: "grok-4.6", label: "Grok 4.6" },
    max: { model: "grok-4.6", label: "Grok 4.6" },
  },
};

/** Highest tier a plan may reach. */
export function planCeilingTier(plan: PlanId): ModelTier {
  if (plan === "premium") return "max";
  if (plan === "pro") return "high";
  return "basic";
}

/** Default tier for a plan (its ceiling — best output out of the box). */
export function defaultTierForPlan(plan: PlanId): ModelTier {
  return planCeilingTier(plan);
}

function tierRank(tier: ModelTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Every tier a plan can select, basic → ceiling (for the downgrade dropdown). */
export function tiersForPlan(plan: PlanId): ModelTier[] {
  const ceil = tierRank(planCeilingTier(plan));
  return TIER_ORDER.filter((_, i) => i <= ceil);
}

/** Clamp a requested tier down to the plan ceiling (never above what's paid for). */
export function clampTierToPlan(tier: ModelTier, plan: PlanId): ModelTier {
  const ceil = planCeilingTier(plan);
  return tierRank(tier) > tierRank(ceil) ? ceil : tier;
}

function isModelTier(value: unknown): value is ModelTier {
  return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value);
}

/**
 * Resolve the exact model id to call:
 *   1. MESH_MODEL_<PROVIDER> env override wins (owner pin).
 *   2. otherwise the requested tier, clamped to the plan ceiling (default = ceiling).
 */
export function resolveMeshModel(
  provider: MeshProvider,
  plan: PlanId,
  requestedTier: unknown,
  env: Record<string, string | undefined> = process.env,
): string {
  const pinned = env[modelEnvName(provider)]?.trim();
  if (pinned) return pinned;
  const wanted = isModelTier(requestedTier) ? requestedTier : defaultTierForPlan(plan);
  const tier = clampTierToPlan(wanted, plan);
  return PROVIDER_TIERS[provider][tier].model;
}

/** UI-facing tier options for a provider under a plan (label + model + selectable). */
export function tierOptionsForPlan(
  provider: MeshProvider,
  plan: PlanId,
): { tier: ModelTier; label: string; model: string; isDefault: boolean }[] {
  const def = defaultTierForPlan(plan);
  return tiersForPlan(plan).map((tier) => ({
    tier,
    label: PROVIDER_TIERS[provider][tier].label,
    model: PROVIDER_TIERS[provider][tier].model,
    isDefault: tier === def,
  }));
}

/** Guard so a bad catalog never ships a provider with missing tiers. */
export function everyProviderHasEveryTier(): boolean {
  return (Object.keys(PROVIDER_TIERS) as MeshProvider[]).every((p) =>
    TIER_ORDER.every((t) => Boolean(PROVIDER_TIERS[p][t]?.model)),
  );
}
