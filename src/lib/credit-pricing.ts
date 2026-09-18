/**
 * Credit Pricing Engine
 * Pure math module — no I/O, fully testable.
 *
 * Model:
 * - 1000 credits = €1 display
 * - Transaction-level tier assignment (each top-up independently evaluated)
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
  /** EUR paid per credit (amountEuros / creditsAwarded). */
  costPerCredit: number;
  margin: number; // Markup multiplier (e.g., 3.5)
}

export type TopUpGrant = {
  userId: string;
  amountEuros: number;
  creditsToGrant: number;
  markupTier: number;
};

/**
 * Determine markup tier based on transaction amount.
 * Each transaction is independently evaluated.
 */
export const getMarkupTier = (amountEuros: number): number => {
  if (amountEuros >= 100) {
    return 2.5;
  }
  if (amountEuros >= 30) {
    return 3.0;
  }
  return 3.5;
};

/**
 * Calculate credits to award for a top-up amount.
 *
 * Formula:
 * credits = amountEuros × 1000 × markupTier
 *
 * Example:
 * - €10 at 3.5× = 10 × 1000 × 3.5 = 35,000 credits
 * - €100 at 2.5× = 100 × 1000 × 2.5 = 250,000 credits
 */
export const calculateCredits = (amountEuros: number): PricingResult => {
  if (amountEuros < 10) {
    throw new Error("Minimum top-up is €10");
  }

  if (amountEuros > 10000) {
    throw new Error("Maximum top-up is €10,000");
  }

  const markupTier = getMarkupTier(amountEuros);
  const creditsAwarded = Math.floor(amountEuros * 1000 * markupTier);

  // Cost per credit (in EUR, for reference)
  const costPerCredit = amountEuros / creditsAwarded;

  return {
    amountEuros,
    markupTier,
    creditsAwarded,
    costPerCredit,
    margin: markupTier,
  };
};

/**
 * Validate that pricing meets minimum margin floor (2.5×).
 */
export const validateMargin = (pricing: PricingResult): boolean => {
  return pricing.margin >= 2.5;
};

/**
 * For display: convert credits to EUR equivalent at 1000 = €1 rate.
 */
export const creditsToEuroDisplay = (credits: number): number => {
  return credits / 1000;
};

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
export const calculateSubscriptionGrant = (
  creditsAwarded: number,
): number => {
  return Math.floor(creditsAwarded * 0.1);
};

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
  const userId = typeof userIdRaw === "string" && userIdRaw.trim() ? userIdRaw.trim() : "";

  const amountEuros = Number(metadata.amountEuros);
  let creditsToGrant = 0;
  let markupTier = 0;

  if (Number.isFinite(amountEuros)) {
    try {
      const pricing = calculateCredits(amountEuros);
      creditsToGrant = pricing.creditsAwarded;
      markupTier = pricing.markupTier;
    } catch {
      creditsToGrant = 0;
    }
  }

  if (creditsToGrant <= 0) {
    const parsedCredits = Number.parseInt(String(metadata.creditsToGrant ?? "0"), 10);
    const parsedMarkup = Number.parseFloat(String(metadata.markupTier ?? "0"));
    if (Number.isFinite(parsedCredits) && parsedCredits > 0) {
      creditsToGrant = parsedCredits;
      markupTier = Number.isFinite(parsedMarkup) ? parsedMarkup : 0;
    }
  }

  if (!userId || creditsToGrant <= 0) return null;

  return {
    userId,
    amountEuros: Number.isFinite(amountEuros) ? amountEuros : 0,
    creditsToGrant,
    markupTier,
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
  const creditsAwarded = pricing.creditsAwarded;

  // Approximate cost per turn (in credits) at Balanced tier
  // Adjust these based on actual API costs
  const costPerTurn = {
    Budget: 200, // ~46 turns per €10
    Balanced: 435, // ~23 turns per €10
    Flagship: 775, // ~13 turns per €10 (Flagship is expensive)
  };

  return Math.floor(creditsAwarded / costPerTurn[tier]);
};

/**
 * Test suite helpers (run with Node or vitest).
 */
export const testPricing = () => {
  const test1 = calculateCredits(10);
  console.log("€10 at 3.5×:", test1);
  console.assert(test1.creditsAwarded === 35000, "€10 should yield 35k credits");

  const test2 = calculateCredits(100);
  console.log("€100 at 2.5×:", test2);
  console.assert(test2.creditsAwarded === 250000, "€100 should yield 250k credits");

  const test3 = calculateCredits(50);
  console.log("€50 at 3.0×:", test3);
  console.assert(test3.creditsAwarded === 150000, "€50 should yield 150k credits");

  // All tiers meet floor
  [10, 30, 100].forEach((amount) => {
    const pricing = calculateCredits(amount);
    console.assert(
      validateMargin(pricing),
      `Amount €${amount} must have margin ≥ 2.5×`,
    );
  });

  console.log("✓ All pricing tests passed");
};
