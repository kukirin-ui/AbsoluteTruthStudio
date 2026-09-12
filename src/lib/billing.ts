import type { PlanId } from "./types";
import { readOwner } from "./owner";

export type BillingMethod = "stripe";

export type PlanDef = {
  id: PlanId;
  name: string;
  price: string;
  amountCents: number;
  tagline: string;
  why: string;
  features: string[];
  stripePriceLookup: string | null;
};

export const STRIPE_LINKS: Record<Exclude<PlanId, "free">, string> = {
  pro: "https://buy.stripe.com/aFa4gsc9A5fecAW7pl1wY00",
  premium: "https://buy.stripe.com/5kQeV61uWdLKeJ4bFB1wY01",
};

export const STRIPE_PRICE_IDS: Record<Exclude<PlanId, "free">, string> = {
  pro: "price_1UEY6T42Bm7XSb7pJ5KD2MIH",
  premium: "price_1UEY6V42Bm7XSb7pRm8c7deU",
};

export const STRIPE_ACCOUNT = "acct_1UEWjK42Bm7XSb7p";

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    amountCents: 0,
    tagline: "4 tabs + agent swap. Evaluate system logic.",
    why: "Best for: Evaluating system logic. Talk to Me, baseline seats, file attach, and memory. Video is not on Free.",
    stripePriceLookup: null,
    features: [
      "Four specialized tabs with agent swap — never fixed agents",
      "Talk to Me — answer, then one follow-up",
      "Baseline React apps in the live preview",
      "25 free agents and tools — swap any tab",
      "4,000-character memory per seat",
      "Attach a photo or file with +",
      "Three trial stills — no Free video",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    amountCents: 1900,
    tagline: "Professional MVPs. Sources, stills, plugins.",
    why: "Best for: Professional MVPs. Upgraded concurrency and debug loops, sources export, stills, and optional render plugins with credits.",
    stripePriceLookup: "ats_pro_monthly",
    features: [
      "Talk with source links",
      "Real React apps — ZIP / Sync / GitHub · See Code",
      "Imagine stills included",
      "Optional render plugins with credits",
      "Agent swap across all 50 catalog entries (paid ones via integrate)",
      "Brand Kit on the Visual seat",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49",
    amountCents: 4900,
    tagline: "Frontier seat frameworks. Full catalog.",
    why: "Best for: Technical founders requiring zero-compromise output. Newest frameworks, consensus rigor, live source, priority mesh. Metered plugins need credits — never unlimited render in the sub.",
    stripePriceLookup: "ats_premium_monthly",
    features: [
      "All 50 agents and tools included",
      "Imagine Image Quality stills + reference lock from +",
      "Live source editing of the shipped app",
      "Spec Compiler + Deep Audit + priority mesh",
      "Optional render plugins (attach, don't force)",
      "Credits for metered plugins — attach Kling only if needed",
    ],
  },
];

export function planRank(plan: PlanId) {
  return plan === "premium" ? 2 : plan === "pro" ? 1 : 0;
}

export function canTalk(plan: PlanId) {
  return Boolean(plan);
}

export function canCiteSources(plan: PlanId) {
  return planRank(plan) >= 1;
}

export function canBuild(plan: PlanId) {
  return planRank(plan) >= 1;
}

export function canEditCode(plan: PlanId) {
  return plan === "premium";
}

export function canViewCode(plan: PlanId) {
  return plan === "premium";
}

export type CheckoutResult =
  | { ok: true; plan: PlanId; method: BillingMethod; mode: "local" | "redirect"; url?: string }
  | { ok: false; error: string };

export async function initiateCheckout(
  plan: Exclude<PlanId, "free">,
  method: BillingMethod,
): Promise<CheckoutResult> {
  const def = PLANS.find((p) => p.id === plan);
  if (!def) return { ok: false, error: "Unknown plan" };

  if (method === "stripe") {
    const stripeUrl =
      (typeof window !== "undefined"
        ? (window as unknown as { STRIPE_CHECKOUT?: string }).STRIPE_CHECKOUT
        : undefined) || STRIPE_LINKS[plan];
    if (!stripeUrl) return { ok: false, error: "Missing Stripe price mapping" };
    return { ok: true, plan, method, mode: "redirect", url: stripeUrl };
  }

  return { ok: false, error: "Stripe is the only payment method." };
}
