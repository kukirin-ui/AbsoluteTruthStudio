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
    why: "For: trying the studio. The same four frontier seats — Claude, ChatGPT, Gemini, Grok — run at their basic, low-cost tier so you can feel the multi-agent lockstep before you pay. Capped usage, because these calls spend our credits.",
    stripePriceLookup: null,
    features: [
      "Four frontier seats — Claude · ChatGPT · Gemini · Grok",
      "Run 1–4 agents; pick who sits each seat",
      "Basic tier only — capped daily usage",
      "Talk to Me — verified answer + one follow-up",
      "Baseline React apps in the live preview",
      "4,000-character memory per seat",
      "25 free plugins — swap any seat",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    amountCents: 1900,
    tagline: "Mid-tier frontier models. Serious work, real margin.",
    why: "For: builders shipping real products. The four seats step up a few tiers from Free, and you choose the exact level per seat — dial each agent up to Pro's ceiling or down to save. Verified sources, shippable React apps, and the full free-plugin shelf.",
    stripePriceLookup: "ats_pro_monthly",
    features: [
      "Four seats at mid-tier — you pick the level per seat",
      "Per-agent tier selector · run 1–4 agents",
      "Verified answers with source links",
      "Real React apps — ZIP / Sync / GitHub · See Code",
      "All 25 free plugins — no paid plugins forced",
      "Output power: low / mid / max",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49",
    amountCents: 4900,
    tagline: "Highest tier known today. Zero-compromise output.",
    why: "For: operators who ship elite, worldwide-grade content. Every seat defaults to the highest tier available today — updated as the frontier moves — and you can select any lower level per seat if you want. Live source editing, priority mesh, and the deepest consensus rigor in the catalog.",
    stripePriceLookup: "ats_premium_monthly",
    features: [
      "Every seat at the highest tier known today (kept current)",
      "Full per-agent tier control · run 1–4 agents",
      "Output power: low / mid / max — full ceiling",
      "Live source editing of the shipped app",
      "Priority mesh — longest consensus, four seats in lockstep",
      "All 25 free plugins · bring paid ones with your own keys",
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
