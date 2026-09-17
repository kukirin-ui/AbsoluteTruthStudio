/**
 * Client helper for GET /api/meter.
 * Prefer live snapshot when session/Auth works; callers fall back to local mock.
 */

export type MeterSnapshot = {
  userId: string;
  plan: string;
  billingInterval: "monthly" | "annual" | null;
  bufferCentsTotal: number;
  bufferCentsRemaining: number;
  creditCents: number;
  hasByok: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  bufferRateBps: number;
};

export type MeterFetchResult =
  | { ok: true; meter: MeterSnapshot }
  | { ok: false; status: number; code?: string };

export async function fetchMeter(): Promise<MeterFetchResult> {
  try {
    const res = await fetch("/api/meter", { method: "GET", credentials: "include" });
    if (!res.ok) {
      let code: string | undefined;
      try {
        const body = (await res.json()) as { code?: string };
        code = typeof body.code === "string" ? body.code : undefined;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, code };
    }
    const meter = (await res.json()) as MeterSnapshot;
    return {
      ok: true,
      meter: {
        ...meter,
        creditCents: Number.isFinite(meter.creditCents) ? Math.max(0, Math.trunc(meter.creditCents)) : 0,
        hasByok: meter.hasByok === true,
      },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Format credit cents for chrome badge (e.g. $1.50). */
export function formatCreditCents(creditCents: number): string {
  const cents = Number.isFinite(creditCents) ? Math.max(0, Math.trunc(creditCents)) : 0;
  return `$${(cents / 100).toFixed(2)}`;
}
