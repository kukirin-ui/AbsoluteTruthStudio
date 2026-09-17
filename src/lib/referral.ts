const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeReferralCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const FOUNDING_SLOTS = 50;
export const FOUNDING_PRICE = "$9.99";
export const FOUNDING_MONTHS = 3;
export const REFERRER_MONTHS = 1;

export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export type ReferralState = {
  code: string;
  referredBy?: string;
  founding?: boolean;
  foundingUntil?: number;
  conversions: number;
};

export const EMPTY_REFERRAL: ReferralState = {
  code: "",
  conversions: 0,
};

export type FoundingStatus = {
  remaining: number;
  claimed: number;
  referrerProUntil?: number;
  conversions: number;
};

export async function fetchFounding(code?: string): Promise<FoundingStatus> {
  const q = code ? `?code=${encodeURIComponent(code)}` : "";
  const res = await fetch(`/api/referrals${q}`);
  if (!res.ok) return { remaining: FOUNDING_SLOTS, claimed: 0, conversions: 0 };
  return (await res.json()) as FoundingStatus;
}

export async function claimFounding(input: {
  code: string;
  referredBy?: string;
}): Promise<FoundingStatus & { ok: boolean; error?: string }> {
  const res = await fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "founding", ...input }),
  });
  const body = (await res.json()) as FoundingStatus & { ok?: boolean; error?: string };
  if (!res.ok) return { remaining: 0, claimed: FOUNDING_SLOTS, conversions: 0, ok: false, error: body.error };
  return { ...body, ok: true };
}
