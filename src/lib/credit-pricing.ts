/**
 * Credit Pricing Engine
 * Pure math module — no I/O, fully testable.
 *
 * Model:
 * - 1000 credits = €1 display (creditsAwarded = amountEuros × 1000)
 * - Markup is an internal API-budget split, not extra credits
 * - €10–29: 3.5× markup
 * - €30–99: 3.0× markup
 * - €100+: 2.5× markup
 *
 * Wallet mapping (this app stores spendable EUR cents in credit_wallets):
 * - 1000 credits = 100 cents → cents = floor(credits / 10)
 */

export type PricingTier = "budget" | "standard" | "premium";

export interface PricingResult {
  amountEuros: number;
  markupTier: number;
  creditsAwarded: number;
  apiBudgetCost: number;
  profitMargin: number;
  margin: number;
}

export type TopUpGrant = {
  userId: string;
  amountEuros: number;
  creditsToGrant: number;
  markupTier: number;
  apiBudgetCost: number;
};

/**
 * Determine markup tier based on transaction amount.
 * Each transaction is independently evaluated.
 */
export const getMarkupTier = (amountEuros: number): number => {
  if (amountEuros >= 100) return 2.5;
  if (amountEuros >= 30) return 3.0;
  return 3.5;
};

/**
 * Calculate credits to award for a top-up amount.
 *
 * Formula:
 * credits = amountEuros × 1000
 * apiBudgetCost = amountEuros / markupTier
 *
 * Example:
 * - €10 → 10,000 credits (API budget €10 / 3.5)
 * - €100 → 100,000 credits (API budget €100 / 2.5)
 */
export const calculateCredits = (amountEuros: number): PricingResult => {
  if (amountEuros < 10) throw new Error("Minimum top-up is €10");
  if (amountEuros > 10000) throw new Error("Maximum top-up is €10,000");

  const markupTier = getMarkupTier(amountEuros);
  const creditsAwarded = Math.floor(amountEuros * 1000);
  const apiBudgetCost = amountEuros / markupTier;
  const profitMargin = amountEuros - apiBudgetCost;

  return {
    amountEuros,
    markupTier,
    creditsAwarded,
    apiBudgetCost,
    profitMargin,
    margin: markupTier,
  };
};

/**
 * Validate that pricing meets minimum margin floor (2.5×).
 */
export const validateMargin = (pricing: PricingResult): boolean =>
  pricing.margin >= 2.5;

/**
 * For display: convert credits to EUR equivalent at 1000 = €1 rate.
 */
export const creditsToEuroDisplay = (credits: number): number => credits / 1000;

/**
 * Convert awarded credits into wallet cents (credit_wallets.credit_cents).
 * 1000 credits = €1 = 100 cents.
 */
export const creditsToWalletCents = (credits: number): number => {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return Math.floor(credits / 10);
};

/**
 * Convert wallet cents back to display credits.
 */
export const walletCentsToCredits = (cents: number): number => {
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.floor(cents * 10);
};

/**
 * Calculate 10% subscription grant (for subscription payment events).
 */
export const calculateSubscriptionGrant = (creditsAwarded: number): number =>
  Math.floor(creditsAwarded * 0.1);

/**
 * Read top-up fields from Stripe Checkout Session metadata.
 * Recalculates credits from amountEuros when possible so a tampered
 * creditsToGrant cannot inflate the grant.
 */
export const parseTopUpMetadata = (
  metadata: Record<string, unknown> | null | undefined,
): TopUpGrant | null => {
  if (!metadata || typeof metadata !== "object") return null;

  const userIdRaw = metadata.userId ?? metadata.user_id;
  const userId =
    typeof userIdRaw === "string" && userIdRaw.trim() ? userIdRaw.trim() : "";

  const amountEuros = Number(metadata.amountEuros);
  let creditsToGrant = 0;
  let markupTier = 0;
  let apiBudgetCost = 0;

  if (Number.isFinite(amountEuros)) {
    try {
      const pricing = calculateCredits(amountEuros);
      creditsToGrant = pricing.creditsAwarded;
      markupTier = pricing.markupTier;
      apiBudgetCost = pricing.apiBudgetCost;
    } catch {
      creditsToGrant = 0;
    }
  }

  if (creditsToGrant <= 0) {
    const parsedCredits = Number.parseInt(
      String(metadata.creditsToGrant ?? "0"),
      10,
    );
    const parsedMarkup = Number.parseFloat(String(metadata.markupTier ?? "0"));
    if (Number.isFinite(parsedCredits) && parsedCredits > 0) {
      creditsToGrant = parsedCredits;
      markupTier = Number.isFinite(parsedMarkup) ? parsedMarkup : 0;
      const parsedBudget = Number.parseFloat(
        String(metadata.apiBudgetCost ?? "0"),
      );
      apiBudgetCost = Number.isFinite(parsedBudget) ? parsedBudget : 0;
    }
  }

  if (!userId || creditsToGrant <= 0) return null;

  return {
    userId,
    amountEuros: Number.isFinite(amountEuros) ? amountEuros : 0,
    creditsToGrant,
    markupTier,
    apiBudgetCost,
  };
};

/**
 * Estimate turn count for user education.
 * Real costs vary by model; these are ballpark for Balanced tier.
 */
export const estimateTurnsForAmount = (
  amountEuros: number,
  tier: "Budget" | "Balanced" | "Flagship",
): number => {
  const pricing = calculateCredits(amountEuros);
  const costPerTurn = { Budget: 200, Balanced: 435, Flagship: 775 };
  return Math.floor(pricing.creditsAwarded / costPerTurn[tier]);
};
