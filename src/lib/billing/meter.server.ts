/**
 * Server-side usage meter (server-only).
 * CONTRACT: owner pays provider keys → included buffer is 0%.
 * Debit order: credit_wallets first, then any residual buffer_cents.
 * Hard stop when neither covers. UI should show credits remaining.
 *
 * DB deps are lazy so InsufficientBufferError can be unit-tested without Vite/PGLite.
 */
import { randomUUID } from "node:crypto";
import type { PlanId, AgentId } from "@/lib/types";

/** Included sub-% buffer is OFF (0%) when owner funds provider keys. */
const DEFAULT_BUFFER_RATE_BPS = 0;

export class InsufficientBufferError extends Error {
  readonly code = "INSUFFICIENT_BUFFER" as const;
  readonly status = 402;
  readonly bufferCentsRemaining: number;
  readonly creditCents: number;
  readonly requestedCents: number;

  constructor(opts: {
    requestedCents: number;
    bufferCentsRemaining: number;
    creditCents: number;
  }) {
    super("Insufficient buffer and credits");
    this.name = "InsufficientBufferError";
    this.requestedCents = opts.requestedCents;
    this.bufferCentsRemaining = opts.bufferCentsRemaining;
    this.creditCents = opts.creditCents;
  }
}

export type MeterSnapshot = {
  userId: string;
  plan: PlanId;
  billingInterval: "monthly" | "annual" | null;
  bufferCentsTotal: number;
  bufferCentsRemaining: number;
  creditCents: number;
  /** True when user has any byok_credentials row (Frontend BYOK badge). */
  hasByok: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  bufferRateBps: number;
};

export type DebitMeterInput = {
  cents: number;
  seat?: AgentId | string | null;
  provider?: string | null;
  modelId?: string | null;
  meshRunId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

export type DebitMeterResult = {
  ok: true;
  userId: string;
  centsDebited: number;
  fromBuffer: number;
  fromCredits: number;
  bufferCentsRemaining: number;
  creditCents: number;
};

type EntitlementRow = {
  plan: string;
  billing_interval: string | null;
  buffer_cents_total: number;
  buffer_cents_remaining: number;
  buffer_rate_bps: number;
  period_start: Date | string | null;
  period_end: Date | string | null;
};

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

function asPlan(plan: string): PlanId {
  if (plan === "pro" || plan === "premium" || plan === "free") return plan;
  return "free";
}

function asInterval(v: string | null): "monthly" | "annual" | null {
  if (v === "monthly" || v === "annual") return v;
  return null;
}

export async function getMeter(userId: string): Promise<MeterSnapshot> {
  const { getSql } = await import("@/lib/db");
  const { ensureFreeEntitlement } = await import(
    "@/lib/auth/entitlements.server"
  );
  await ensureFreeEntitlement(userId);
  const sql = await getSql();

  const rows = await sql<EntitlementRow>`
    select
      plan,
      billing_interval,
      buffer_cents_total,
      buffer_cents_remaining,
      buffer_rate_bps,
      period_start,
      period_end
    from entitlements
    where user_id = ${userId}
    limit 1
  `;

  const wallet = await sql<{ credit_cents: number }>`
    select credit_cents from credit_wallets where user_id = ${userId} limit 1
  `;

  const byok = await sql<{ n: number }>`
    select 1::int as n from byok_credentials where user_id = ${userId} limit 1
  `;

  const e = rows[0];
  return {
    userId,
    plan: asPlan(e?.plan ?? "free"),
    billingInterval: asInterval(e?.billing_interval ?? null),
    bufferCentsTotal: e?.buffer_cents_total ?? 0,
    bufferCentsRemaining: e?.buffer_cents_remaining ?? 0,
    creditCents: wallet[0]?.credit_cents ?? 0,
    hasByok: byok.length > 0,
    periodStart: toIso(e?.period_start ?? null),
    periodEnd: toIso(e?.period_end ?? null),
    // Effective included rate is 0 when buffer pool is empty (CONTRACT).
    bufferRateBps:
      (e?.buffer_cents_total ?? 0) === 0
        ? 0
        : (e?.buffer_rate_bps ?? DEFAULT_BUFFER_RATE_BPS),
  };
}

/**
 * Debit credit wallet first, then any residual buffer.
 * Throws InsufficientBufferError when neither covers `cents`.
 */
export async function debitMeter(
  userId: string,
  input: DebitMeterInput,
): Promise<DebitMeterResult> {
  const cents = input.cents;
  if (!Number.isFinite(cents) || cents <= 0 || !Number.isInteger(cents)) {
    throw new Error("cents must be a positive integer");
  }

  const { getSql } = await import("@/lib/db");
  const { ensureFreeEntitlement } = await import(
    "@/lib/auth/entitlements.server"
  );
  await ensureFreeEntitlement(userId);
  const sql = await getSql();

  const entRows = await sql<{ buffer_cents_remaining: number }>`
    select buffer_cents_remaining from entitlements where user_id = ${userId} limit 1
  `;
  const walletRows = await sql<{ credit_cents: number }>`
    select credit_cents from credit_wallets where user_id = ${userId} limit 1
  `;

  const bufferRemaining = entRows[0]?.buffer_cents_remaining ?? 0;
  const creditCents = walletRows[0]?.credit_cents ?? 0;

  if (bufferRemaining + creditCents < cents) {
    throw new InsufficientBufferError({
      requestedCents: cents,
      bufferCentsRemaining: bufferRemaining,
      creditCents,
    });
  }

  // Credits primary (owner-funded provider keys → no included sub-% pool).
  const fromCredits = Math.min(creditCents, cents);
  const fromBuffer = cents - fromCredits;

  let newCredits = creditCents;
  if (fromCredits > 0) {
    const updated = await sql<{ credit_cents: number }>`
      update credit_wallets
      set
        credit_cents = credit_cents - ${fromCredits},
        updated_at = now()
      where user_id = ${userId}
        and credit_cents >= ${fromCredits}
      returning credit_cents
    `;
    if (updated.length === 0) {
      throw new InsufficientBufferError({
        requestedCents: cents,
        bufferCentsRemaining: bufferRemaining,
        creditCents,
      });
    }
    newCredits = updated[0].credit_cents;
  }

  let newBuffer = bufferRemaining;
  if (fromBuffer > 0) {
    const updated = await sql<{ buffer_cents_remaining: number }>`
      update entitlements
      set
        buffer_cents_remaining = buffer_cents_remaining - ${fromBuffer},
        updated_at = now()
      where user_id = ${userId}
        and buffer_cents_remaining >= ${fromBuffer}
      returning buffer_cents_remaining
    `;
    if (updated.length === 0) {
      if (fromCredits > 0) {
        await sql`
          update credit_wallets
          set
            credit_cents = credit_cents + ${fromCredits},
            updated_at = now()
          where user_id = ${userId}
        `;
      }
      throw new InsufficientBufferError({
        requestedCents: cents,
        bufferCentsRemaining: bufferRemaining,
        creditCents,
      });
    }
    newBuffer = updated[0].buffer_cents_remaining;
  }

  const ledgerId = `ul_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const seat = input.seat ?? null;
  const provider = input.provider ?? null;
  const modelId = input.modelId ?? null;
  const meshRunId = input.meshRunId ?? null;
  const tokensIn = input.tokensIn ?? null;
  const tokensOut = input.tokensOut ?? null;
  const metaJson = JSON.stringify({ fromBuffer, fromCredits });

  await sql`
    insert into usage_ledger (
      id, user_id, kind, seat, provider, model_id,
      tokens_in, tokens_out, cents_delta, buffer_remaining_after,
      mesh_run_id, meta
    ) values (
      ${ledgerId},
      ${userId},
      ${"mesh_debit"},
      ${seat},
      ${provider},
      ${modelId},
      ${tokensIn},
      ${tokensOut},
      ${-cents},
      ${newBuffer},
      ${meshRunId},
      ${metaJson}::jsonb
    )
  `;

  return {
    ok: true,
    userId,
    centsDebited: cents,
    fromBuffer,
    fromCredits,
    bufferCentsRemaining: newBuffer,
    creditCents: newCredits,
  };
}
