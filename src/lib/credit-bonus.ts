import type { PlanId } from "./types";
import { PLANS } from "./billing";

/**
 * Calculates the 10% credit bonus awarded upon successful subscription purchase.
 * The subscription pays for the platform ceiling; this bonus is a welcome gift 
 * to immediately test paid plugins without extra top-ups.
 */
export function calculateSubscriptionCreditBonus(planId: PlanId): number {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.id === "free") return 0;

  // plan.amountCents is in cents (e.g., 1900 for $19)
  // We take 10% of the amount in cents, then round to avoid floating point issues.
  const bonusCents = Math.round(plan.amountCents * 0.10);
  
  return bonusCents;
}

/**
 * Example usage in your Stripe Webhook / Checkout Success handler:
 * 
 * async function handleSuccessfulSubscription(userId: string, planId: PlanId) {
 *   // 1. Update user's plan in database
 *   await db.updateUserPlan(userId, planId);
 * 
 *   // 2. Calculate and award the 10% credit bonus
 *   const bonusCents = calculateSubscriptionCreditBonus(planId);
 *   if (bonusCents > 0) {
 *     await db.addCredits(userId, bonusCents, `Subscription bonus: 10% of ${planId} plan`);
 *   }
 * 
 *   // 3. Log the transaction
 *   await db.logTransaction(userId, 'subscription_bonus', bonusCents);
 * }
 */