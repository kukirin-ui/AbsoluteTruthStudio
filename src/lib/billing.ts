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
    tagline: "Basic-tier mesh. Try the product on us.",
    why: "For: trying the studio. The four frontier seats run at their basic tier so you can feel the multi-agent lockstep before you pay. Capped, because these calls spend our credits.",
    stripePriceLookup: null,
    features: [
      "Four frontier seats — Claude · ChatGPT · Gemini · Grok",
      "Run 1, 2, 3, or all 4 agents — you choose",
      "Basic tier only — capped daily usage",
      "Verified answers + baseline React apps",
      "4,000-character memory per seat",
      "25 free plugins — combine freely",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    amountCents: 1900,
    tagline: "Mid-tier frontier models. Not free usage — a better engine.",
    why: "For: builders shipping real products. Pro raises the tier ceiling a few levels below Premium so you can see what the top can do, and you dial each agent up to that ceiling or down to save. It is NOT free model calls — you fund runs with studio credits (1.3× real cost) or your own API keys. What you buy is the software: run any model combination with no cap on what you build.",
    stripePriceLookup: "ats_pro_monthly",
    features: [
      "Higher tier ceiling — exact model per seat, downgrade anytime",
      "Run 1–4 agents · fund with credits or your own keys (BYOK)",
      "BYOK any model — even ones beyond the main four",
      "Verified answers with source links",
      "Real React apps — ZIP / Sync / GitHub · See Code",
      "All 25 free plugins — combine without limits",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49",
    amountCents: 4900,
    tagline: "Highest tier known today. Zero-compromise output.",
    why: "For: operators who ship elite, worldwide-grade content. Every agent — the main four AND everything in the library — defaults to the highest tier available today, kept current as the frontier moves, and you can downgrade any seat by exact name if you want. Still not free usage: fund runs with credits (1.3×) or BYOK. What you own is a platform with no limits on what you combine — any models, any plugins, 1 to 4 agents.",
    stripePriceLookup: "ats_premium_monthly",
    features: [
      "Every agent at the highest tier known today (kept current)",
      "Downgrade any seat by exact model name · run 1–4 agents",
      "Fund with credits (1.3×) or BYOK — any model you own",
      "Live source editing of the shipped app",
      "Priority mesh — longest consensus, seats in lockstep",
      "All plugins — combine anything, no creative limits",
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
