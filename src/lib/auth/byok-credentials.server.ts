/**
 * BYOK credential persistence (server-only).
 * Stores ciphertext only. Never return plaintext/ciphertext to HTTP clients.
 * decryptByokForAdapter is for server provider adapters only.
 */
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  ByokDecryptError,
  ByokNotConfiguredError,
  decryptByokSecret,
  encryptByokSecret,
} from "./byok-crypto.server";

export type ByokProvider =
  | "openai"
  | "anthropic"
  | "xai"
  | "google"
  | "mistral"
  | "deepseek"
  | "qwen"
  | "meta";

export const BYOK_PROVIDERS: readonly ByokProvider[] = [
  "openai",
  "anthropic",
  "xai",
  "google",
  "mistral",
  "deepseek",
  "qwen",
  "meta",
] as const;

export function isByokProvider(value: string): value is ByokProvider {
  return (BYOK_PROVIDERS as readonly string[]).includes(value);
}

export type ByokCredentialMeta = {
  provider: ByokProvider;
  label: string | null;
  keyVersion: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ByokUpsertMeta = {
  provider: ByokProvider;
  label: string | null;
  keyVersion: string;
  updatedAt: string;
};

type ByokRow = {
  id: string;
  user_id: string;
  provider: string;
  ciphertext: string;
  nonce: string;
  key_version: string;
  label: string | null;
  last_used_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toIsoRequired(value: Date | string): string {
  return toIso(value) ?? new Date().toISOString();
}

/**
 * Encrypt + upsert on (user_id, provider). Returns metadata only — never plaintext.
 */
export async function upsertByokCredential(args: {
  userId: string;
  provider: ByokProvider;
  plaintext: string;
  label?: string | null;
}): Promise<ByokUpsertMeta> {
  const { userId, provider, plaintext } = args;
  const label =
    typeof args.label === "string" && args.label.trim()
      ? args.label.trim()
      : null;

  const { ciphertext, nonce, keyVersion } = encryptByokSecret(plaintext);
  const id = randomUUID();
  const sql = await getSql();

  const rows = await sql<ByokRow>`
    insert into byok_credentials (
      id, user_id, provider, ciphertext, nonce, key_version, label, updated_at
    )
    values (
      ${id}, ${userId}, ${provider}, ${ciphertext}, ${nonce}, ${keyVersion},
      ${label}, now()
    )
    on conflict (user_id, provider) do update set
      ciphertext = excluded.ciphertext,
      nonce = excluded.nonce,
      key_version = excluded.key_version,
      label = excluded.label,
      updated_at = now()
    returning provider, label, key_version, updated_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("BYOK upsert returned no row");
  }

  return {
    provider: row.provider as ByokProvider,
    label: row.label,
    keyVersion: row.key_version,
    updatedAt: toIsoRequired(row.updated_at),
  };
}

/** Delete the caller's credential for provider only (scoped to userId). */
export async function deleteByokCredential(
  userId: string,
  provider: ByokProvider,
): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    delete from byok_credentials
    where user_id = ${userId} and provider = ${provider}
    returning id
  `;
  return rows.length > 0;
}

/** List metadata only — no ciphertext/nonce/plaintext. */
export async function listByokCredentialMeta(
  userId: string,
): Promise<ByokCredentialMeta[]> {
  const sql = await getSql();
  const rows = await sql<ByokRow>`
    select provider, label, key_version, last_used_at, created_at, updated_at
    from byok_credentials
    where user_id = ${userId}
    order by provider asc
  `;
  return rows.map((row) => ({
    provider: row.provider as ByokProvider,
    label: row.label,
    keyVersion: row.key_version,
    lastUsedAt: toIso(row.last_used_at),
    createdAt: toIsoRequired(row.created_at),
    updatedAt: toIsoRequired(row.updated_at),
  }));
}

/**
 * Existence check for mesh funded gate (Backend). Optionally scoped to one provider.
 * Never returns key material.
 */
export async function hasByokCredential(
  userId: string,
  provider?: ByokProvider,
): Promise<boolean> {
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
 * Load + decrypt for server provider adapters only.
 * Touches last_used_at. Returns null if no row. Throws ByokDecryptError / ByokNotConfiguredError.
 * Never log the returned plaintext.
 */
export async function decryptByokForAdapter(
  userId: string,
  provider: ByokProvider,
): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<ByokRow>`
    select ciphertext, nonce, key_version
    from byok_credentials
    where user_id = ${userId} and provider = ${provider}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const plaintext = decryptByokSecret(
    row.ciphertext,
    row.nonce,
    row.key_version,
  );

  await sql`
    update byok_credentials
    set last_used_at = now()
    where user_id = ${userId} and provider = ${provider}
  `;

  return plaintext;
}

export { ByokDecryptError, ByokNotConfiguredError };
