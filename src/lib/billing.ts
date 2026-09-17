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

// Dodan "starter" s placeholder linkovima (zamijeni ih kad kreiraš prave u Stripeu)
export const STRIPE_LINKS: Record<Exclude<PlanId, "free">, string> = {
  starter: "https://buy.stripe.com/PLACEHOLDER_STARTER_LINK", 
  pro: "https://buy.stripe.com/aFa4gsc9A5fecAW7pl1wY00",
  premium: "https://buy.stripe.com/5kQeV61uWdLKeJ4bFB1wY01",
};

export const STRIPE_PRICE_IDS: Record<Exclude<PlanId, "free">, string> = {
  starter: "price_PLACEHOLDER_STARTER_ID",
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
    tagline: "Basic-tier mesh. Try the product on us.",
    why: "For trying the studio. The frontier seats run at their basic tier so you can feel the multi-agent lockstep before you pay. Capped, because these calls spend our credits.",
    stripePriceLookup: null,
    features: [
      "Four frontier seats — Claude · ChatGPT · Gemini · Grok",
      "Run 1, 2, 3, or all 4 agents — you choose",
      "Basic tier only — capped daily usage (50 credits)",
      "Verified answers + baseline React apps",
      "4,000-character memory per seat",
      "15 free plugins included",
      "Paid plugins available via credit top-ups",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    amountCents: 900,
    tagline: "Standard-tier models. Serious work, uncapped.",
    why: "For daily users who need reliable, standard-tier models without daily limits. Perfect for focused, single-agent workflows.",
    stripePriceLookup: "ats_starter_monthly",
    features: [
      "Standard tier ceiling — Claude Sonnet, GPT Terra, Gemini Flash, Grok 4.5",
      "Run 1–4 agents · power with credits or your own keys (BYOK)",
      "Uncapped daily usage",
      "Verified answers with real source links",
      "Real React apps — ZIP / Sync / GitHub",
      "15 free plugins included",
      "Paid plugins available via credit top-ups",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    amountCents: 1900,
    tagline: "High-tier frontier models. Ship real products.",
    why: "For builders shipping real products. Pro raises the tier ceiling so you feel the top of the frontier. Power the models with credits or your own keys; a personal key does not raise the ceiling.",
    stripePriceLookup: "ats_pro_monthly",
    features: [
      "High tier ceiling — Claude Opus, GPT Sol, Gemini 3.8 Flash, Grok 4.6",
      "Run 1–4 agents · power with credits or your own keys (BYOK)",
      "Verified answers with real source links",
      "Real React apps — ZIP / Sync / GitHub · See Code",
      "15 free plugins included",
      "Paid plugins available via credit top-ups",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49",
    amountCents: 4900,
    tagline: "Highest tier known today. Zero-compromise output.",
    why: "For operators who ship elite, worldwide-grade work. Every agent runs at the highest tier available today, with per-seat downgrade by exact model name.",
    stripePriceLookup: "ats_premium_monthly",
    features: [
      "Max tier ceiling — Claude Fable, GPT Astra, Gemini 3 Pro, Grok 4.6",
      "Downgrade any seat by exact model name · run 1–4 agents",
      "Power with credits or BYOK — same ceiling, you choose who pays",
      "Live source editing of the shipped app",
      "Priority mesh — longest consensus, seats in lockstep",
      "15 free plugins included",
      "Paid plugins available via credit top-ups",
    ],
  },
];

export function planRank(plan: PlanId) {
  return plan === "premium" ? 3 : plan === "pro" ? 2 : plan === "starter" ? 1 : 0;
}

export function canTalk(plan: PlanId) {
  return Boolean(plan);
}

export function canCiteSources(plan: PlanId) {
  return planRank(plan) >= 1; // Starter, Pro, Premium can cite
}

export function canBuild(plan: PlanId) {
  return planRank(plan) >= 1; // Starter, Pro, Premium can build
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
    
    if (!stripeUrl || stripeUrl.includes("PLACEHOLDER")) {
      return { ok: false, error: "Stripe checkout not yet configured for this plan." };
    }
    
    return { ok: true, plan, method, mode: "redirect", url: stripeUrl };
  }
  return { ok: false, error: "Stripe is the only payment method." };
}