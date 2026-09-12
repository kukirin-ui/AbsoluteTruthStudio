/**
 * BYOK master-key crypto (server-only).
 *
 * Algorithm: AES-256-GCM via Node `crypto` only (no custom crypto).
 * Encoding (documented, locked):
 *   - nonce: base64(12-byte IV)
 *   - ciphertext: base64(ciphertext || authTag)  — ciphertext bytes concatenated
 *     with the 16-byte GCM auth tag, then base64-encoded as a single string
 * keyVersion: always 'v1' for encrypt; decrypt rejects unknown versions.
 *
 * Never log plaintext secrets or the master key.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_VERSION_V1 = "v1" as const;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

export class ByokNotConfiguredError extends Error {
  readonly code = "BYOK_NOT_CONFIGURED" as const;
  readonly status = 503;
  constructor() {
    super("BYOK encryption key is not configured");
    this.name = "ByokNotConfiguredError";
  }
}

export class ByokDecryptError extends Error {
  readonly code = "BYOK_DECRYPT_FAILED" as const;
  constructor() {
    super("Failed to decrypt BYOK credential");
    this.name = "ByokDecryptError";
  }
}

export type ByokEncryptResult = {
  ciphertext: string;
  nonce: string;
  keyVersion: typeof KEY_VERSION_V1;
};

/**
 * Load the 32-byte AES master key from `BYOK_ENCRYPTION_KEY` (base64, trimmed).
 * Throws ByokNotConfiguredError when missing or wrong length.
 */
export function loadByokMasterKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new ByokNotConfiguredError();
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new ByokNotConfiguredError();
  }
  if (key.length !== KEY_BYTES) {
    throw new ByokNotConfiguredError();
  }
  return key;
}

/** Pure encrypt with an explicit key buffer (unit-testable). */
export function encryptWithKey(plaintext: string, key: Buffer): ByokEncryptResult {
  if (key.length !== KEY_BYTES) {
    throw new Error("BYOK key must be 32 bytes");
  }
  const nonce = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // ciphertext || authTag, then base64 — see module header.
  const packed = Buffer.concat([ct, tag]);
  return {
    ciphertext: packed.toString("base64"),
    nonce: nonce.toString("base64"),
    keyVersion: KEY_VERSION_V1,
  };
}

/** Pure decrypt with an explicit key buffer (unit-testable). */
export function decryptWithKey(
  ciphertext: string,
  nonce: string,
  keyVersion: string,
  key: Buffer,
): string {
  if (keyVersion !== KEY_VERSION_V1) {
    throw new ByokDecryptError();
  }
  if (key.length !== KEY_BYTES) {
    throw new ByokDecryptError();
  }
  let packed: Buffer;
  let iv: Buffer;
  try {
    packed = Buffer.from(ciphertext, "base64");
    iv = Buffer.from(nonce, "base64");
  } catch {
    throw new ByokDecryptError();
  }
  if (iv.length !== IV_BYTES || packed.length <= AUTH_TAG_BYTES) {
    throw new ByokDecryptError();
  }
  const tag = packed.subarray(packed.length - AUTH_TAG_BYTES);
  const ct = packed.subarray(0, packed.length - AUTH_TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    throw new ByokDecryptError();
  }
}

/** Encrypt with env master key. */
export function encryptByokSecret(plaintext: string): ByokEncryptResult {
  return encryptWithKey(plaintext, loadByokMasterKey());
}

/** Decrypt with env master key. */
export function decryptByokSecret(
  ciphertext: string,
  nonce: string,
  keyVersion: string,
): string {
  return decryptWithKey(ciphertext, nonce, keyVersion, loadByokMasterKey());
}
