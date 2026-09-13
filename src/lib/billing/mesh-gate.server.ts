/**
 * Mesh funding gate (server-only).
 *
 * CONTRACT:
 * - Credits primary; included buffer is always 0 on owner-keys path.
 * - Funded when creditCents > 0 OR a decrypted xAI BYOK path is available
 *   (presence of openai/anthropic BYOK alone does NOT authorize owner key).
 * - Backend funding allow uses hasByokXai only; hasByok (any provider) is for
 *   meter badge / UI — presence alone does NOT authorize owner XAI_API_KEY.
 * - Never return plaintext keys.
 *
 * Debit floor for studio (owner-key) turns:
 *   MESH_STUDIO_TURN_CENTS — default 1¢. Product may raise via CONTRACT.
 *   Do not invent catalog SKUs or locked turn prices here.
 */

/**
 * Cents debited from credit_wallets per studio-key mesh turn (owner XAI_API_KEY).
 * Floor default = 1. Product may raise via CONTRACT. Not a catalog SKU.
 */
export const MESH_STUDIO_TURN_CENTS = 1;

export type ByokProvider = "openai" | "anthropic" | "xai" | "google";

/**
 * Pure decision: credits > 0 OR hasByokXai ⇒ allow.
 * Non-xAI BYOK (openai/anthropic) alone does NOT allow.
 */
export function decideMeshFunding(
  creditCents: number,
  hasByokXai: boolean,
): { allow: boolean; creditCents: number; hasByokXai: boolean } {
  const credits = Number.isFinite(creditCents) ? Math.max(0, Math.trunc(creditCents)) : 0;
  return {
    allow: credits > 0 || hasByokXai === true,
    creditCents: credits,
    hasByokXai: hasByokXai === true,
  };
}

/**
 * Thrown when mesh would run with neither credits nor xAI BYOK.
 * Prefer PAYMENT_REQUIRED (not INSUFFICIENT_BUFFER) for the unpaid hard-stop.
 */
export class MeshPaymentRequiredError extends Error {
  readonly code = "PAYMENT_REQUIRED" as const;
  readonly status = 402;
  readonly creditCents: number;
  readonly hasByok: boolean;

  constructor(opts: { creditCents: number; hasByok: boolean }) {
    super("Payment required: add credits or connect a BYOK key");
    this.name = "MeshPaymentRequiredError";
    this.creditCents = opts.creditCents;
    this.hasByok = opts.hasByok;
  }
}

/**
 * True when the user has at least one byok_credentials row
 * (optionally scoped to a provider). Never decrypts.
 */
export async function hasByokCredential(
  userId: string,
  provider?: ByokProvider,
): Promise<boolean> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();

  if (provider) {
    const rows = await sql<{ id: string }>`
      select id from byok_credentials
      where user_id = ${userId} and provider = ${provider}
      limit 1
    `;
    return rows.length > 0;
  }

  const rows = await sql<{ id: string }>`
    select id from byok_credentials
    where user_id = ${userId}
    limit 1
  `;
  return rows.length > 0;
}

/**
 * Resolve credit balance + BYOK existence and hard-stop when neither funds mesh.
 * Funding allow = credits > 0 OR the user holds a BYOK key for the lead provider
 * (their own key for whatever model sits the lead seat — any provider).
 * Does not debit. Does not decrypt BYOK.
 */
export async function assertMeshFunding(
  userId: string,
  leadProvider: ByokProvider = "xai",
): Promise<{
  creditCents: number;
  hasByok: boolean;
  hasByokLead: boolean;
}> {
  const { getSql } = await import("@/lib/db");
  const { ensureFreeEntitlement } = await import(
    "@/lib/auth/entitlements.server"
  );
  await ensureFreeEntitlement(userId);
  const sql = await getSql();

  const wallet = await sql<{ credit_cents: number }>`
    select credit_cents from credit_wallets where user_id = ${userId} limit 1
  `;
  const creditCents = wallet[0]?.credit_cents ?? 0;

  const byokAny = await sql<{ id: string; provider: string }>`
    select id, provider from byok_credentials
    where user_id = ${userId}
    limit 8
  `;
  const hasByok = byokAny.length > 0;
  const hasByokLead = byokAny.some((r) => r.provider === leadProvider);

  const decision = decideMeshFunding(creditCents, hasByokLead);
  if (!decision.allow) {
    throw new MeshPaymentRequiredError({
      creditCents: decision.creditCents,
      hasByok,
    });
  }

  return {
    creditCents: decision.creditCents,
    hasByok,
    hasByokLead,
  };
}
