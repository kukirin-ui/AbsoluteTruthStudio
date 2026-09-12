import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  ByokDecryptError,
  ByokNotConfiguredError,
  decryptWithKey,
  encryptWithKey,
  loadByokMasterKey,
} from "./byok-crypto.server.ts";
import { resolveBillingUserId } from "./scale-contract.ts";

function makeKey(): Buffer {
  return randomBytes(32);
}

describe("byok AES-256-GCM roundtrip", () => {
  it("encrypts and decrypts plaintext", () => {
    const key = makeKey();
    const secret = "sk-test-openai-key-abc123";
    const enc = encryptWithKey(secret, key);
    assert.equal(enc.keyVersion, "v1");
    assert.ok(enc.ciphertext.length > 0);
    assert.ok(enc.nonce.length > 0);
    const pt = decryptWithKey(enc.ciphertext, enc.nonce, enc.keyVersion, key);
    assert.equal(pt, secret);
  });

  it("produces different ciphertext for same plaintext (random nonce)", () => {
    const key = makeKey();
    const a = encryptWithKey("same-secret", key);
    const b = encryptWithKey("same-secret", key);
    assert.notEqual(a.nonce, b.nonce);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });

  it("fails decrypt with wrong key", () => {
    const key1 = makeKey();
    const key2 = makeKey();
    const enc = encryptWithKey("sk-secret", key1);
    assert.throws(
      () => decryptWithKey(enc.ciphertext, enc.nonce, enc.keyVersion, key2),
      (err: unknown) => err instanceof ByokDecryptError,
    );
  });

  it("fails decrypt with tampered ciphertext", () => {
    const key = makeKey();
    const enc = encryptWithKey("sk-secret", key);
    const buf = Buffer.from(enc.ciphertext, "base64");
    buf[0] ^= 0xff;
    const tampered = buf.toString("base64");
    assert.throws(
      () => decryptWithKey(tampered, enc.nonce, enc.keyVersion, key),
      (err: unknown) => err instanceof ByokDecryptError,
    );
  });

  it("rejects unknown keyVersion", () => {
    const key = makeKey();
    const enc = encryptWithKey("sk-secret", key);
    assert.throws(
      () => decryptWithKey(enc.ciphertext, enc.nonce, "v9", key),
      (err: unknown) => err instanceof ByokDecryptError,
    );
  });
});

describe("loadByokMasterKey", () => {
  it("throws ByokNotConfiguredError when env missing", () => {
    const prev = process.env.BYOK_ENCRYPTION_KEY;
    delete process.env.BYOK_ENCRYPTION_KEY;
    try {
      assert.throws(
        () => loadByokMasterKey(),
        (err: unknown) =>
          err instanceof ByokNotConfiguredError &&
          err.code === "BYOK_NOT_CONFIGURED",
      );
    } finally {
      if (prev !== undefined) process.env.BYOK_ENCRYPTION_KEY = prev;
      else delete process.env.BYOK_ENCRYPTION_KEY;
    }
  });

  it("loads a valid 32-byte base64 key", () => {
    const prev = process.env.BYOK_ENCRYPTION_KEY;
    const key = makeKey();
    process.env.BYOK_ENCRYPTION_KEY = `  ${key.toString("base64")}  `;
    try {
      const loaded = loadByokMasterKey();
      assert.equal(loaded.length, 32);
      assert.ok(loaded.equals(key));
    } finally {
      if (prev !== undefined) process.env.BYOK_ENCRYPTION_KEY = prev;
      else delete process.env.BYOK_ENCRYPTION_KEY;
    }
  });

  it("rejects wrong-length key", () => {
    const prev = process.env.BYOK_ENCRYPTION_KEY;
    process.env.BYOK_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    try {
      assert.throws(
        () => loadByokMasterKey(),
        (err: unknown) => err instanceof ByokNotConfiguredError,
      );
    } finally {
      if (prev !== undefined) process.env.BYOK_ENCRYPTION_KEY = prev;
      else delete process.env.BYOK_ENCRYPTION_KEY;
    }
  });
});

describe("BYOK IDOR: session userId only", () => {
  it("resolveBillingUserId ignores client body.userId (upsert must use session)", () => {
    assert.equal(
      resolveBillingUserId("session-owner", "attacker-id"),
      "session-owner",
    );
  });
});
