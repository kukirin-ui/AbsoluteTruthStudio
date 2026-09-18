/**
 * Zero-Balance Fallback Logic
 * Integrated into orchestrator mesh to degrade gracefully at €0 balance.
 *
 * Model ids are catalog ids from src/lib/engine.ts (not legacy aliases).
 * DB access is lazy so this module stays client-safe for banner helpers.
 */

export type ModelTier = "Budget" | "Balanced" | "Flagship";

export interface ModelResolution {
  primary: string;
  fallback: string;
  tier: ModelTier;
  isZeroBalanceMode: boolean;
  banner?: string;
  creditsRemaining?: number;
}

const MODEL_MAP: Record<ModelTier, string> = {
  Budget: "qwen3.7-flash",
  Balanced: "claude-sonnet-5",
  Flagship: "gpt-6-astra",
};

const FALLBACK_MODEL = "qwen3.7-flash";
const ZERO_BALANCE_BANNER =
  "💳 Your credits are empty. Switched to Budget mode. Top up for full power.";

export { MODEL_MAP, FALLBACK_MODEL };

/**
 * Pure resolution from an already-known credit balance (display credits).
 * 1000 credits = €1.
 */
export const resolutionFromCredits = (
  creditsRemaining: number,
  userTierPreference: ModelTier = "Balanced",
): ModelResolution => {
  const remaining = Number.isFinite(creditsRemaining)
    ? Math.max(0, Math.floor(creditsRemaining))
    : 0;
  const isZeroBalance = remaining <= 0;

  if (isZeroBalance) {
    return {
      primary: FALLBACK_MODEL,
      fallback: FALLBACK_MODEL,
      tier: "Budget",
      isZeroBalanceMode: true,
      banner: ZERO_BALANCE_BANNER,
      creditsRemaining: 0,
    };
  }

  return {
    primary: MODEL_MAP[userTierPreference],
    fallback: FALLBACK_MODEL,
    tier: userTierPreference,
    isZeroBalanceMode: false,
    creditsRemaining: remaining,
  };
};

/**
 * Determine active model based on wallet balance.
 * If balance is zero, force Budget tier with banner.
 */
export const determineActiveModel = async (
  userId: string,
  userTierPreference: ModelTier,
): Promise<ModelResolution> => {
  const { getSql } = await import("@/lib/db");
  const { walletCentsToCredits } = await import("@/lib/credit-pricing");

  const sql = await getSql();
  const wallet = await sql<{ credit_cents: number }>`
    select credit_cents from credit_wallets where user_id = ${userId} limit 1
  `;

  const creditsCents = wallet[0]?.credit_cents ?? 0;
  const creditsRemaining = walletCentsToCredits(creditsCents);
  return resolutionFromCredits(creditsRemaining, userTierPreference);
};

/**
 * Use this before invoking any agent in the mesh.
 * Returns the model to use and a banner (if any) to display to the user.
 */
export const resolveAgentModel = async (
  userId: string,
  userTierPreference: ModelTier,
  prompt: string,
): Promise<{
  modelToUse: string;
  fallbackModel: string;
  resolution: ModelResolution;
}> => {
  void prompt;
  const resolution = await determineActiveModel(userId, userTierPreference);
  return {
    modelToUse: resolution.primary,
    fallbackModel: resolution.fallback,
    resolution,
  };
};

/**
 * Helper: Format banner for UI display.
 */
export const formatBanner = (resolution: ModelResolution): string | null => {
  if (!resolution.banner) {
    if (resolution.creditsRemaining && resolution.creditsRemaining < 5000) {
      return `⚠️ Low balance: ${resolution.creditsRemaining.toLocaleString("en-US")} credits remaining. Consider topping up.`;
    }
    return null;
  }
  if (resolution.isZeroBalanceMode) {
    return `${resolution.banner} [Credits: ${resolution.creditsRemaining ?? 0}]`;
  }
  return resolution.banner;
};

/** Map a studio plan/engine tier onto the Budget / Balanced / Flagship ladder. */
export const preferenceFromEngineTier = (
  tier: string | null | undefined,
): ModelTier => {
  if (tier === "basic") return "Budget";
  if (tier === "standard") return "Balanced";
  if (tier === "high" || tier === "max") return "Flagship";
  return "Balanced";
};
