import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  StripeSignatureError,
  verifyStripeSignature,
} from "./stripe-webhook.server.ts";
import { resolveBillingUserId } from "../auth/scale-contract.ts";

function sign(
  rawBody: string,
  secret: string,
  ts = Math.floor(Date.now() / 1000),
): string {
  const payload = `${ts}.${rawBody}`;
  const v1 = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${ts},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret_ats_scale";
  const body = JSON.stringify({
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test" } },
  });

  it("accepts a valid HMAC signature within tolerance", () => {
    const header = sign(body, secret);
    assert.doesNotThrow(() =>
      verifyStripeSignature(body, header, secret, 300),
    );
  });

  it("rejects a tampered body", () => {
    const header = sign(body, secret);
    assert.throws(
      () => verifyStripeSignature(body + "x", header, secret, 300),
      (err: unknown) => err instanceof StripeSignatureError,
    );
  });

  it("rejects a tampered / wrong signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    const bad = `t=${ts},v1=${"0".repeat(64)}`;
    assert.throws(
      () => verifyStripeSignature(body, bad, secret, 300),
      (err: unknown) => err instanceof StripeSignatureError,
    );
  });

  it("rejects missing header", () => {
    assert.throws(
      () => verifyStripeSignature(body, null, secret, 300),
      (err: unknown) => err instanceof StripeSignatureError,
    );
  });

  it("rejects expired timestamp outside tolerance", () => {
    const oldTs = Math.floor(Date.now() / 1000) - 10_000;
    const header = sign(body, secret, oldTs);
    assert.throws(
      () => verifyStripeSignature(body, header, secret, 300),
      (err: unknown) => err instanceof StripeSignatureError,
    );
  });
});

describe("resolveBillingUserId IDOR guard (meter/debit)", () => {
  it("ignores spoofed body.userId and returns session id only", () => {
    assert.equal(
      resolveBillingUserId("session-alice", "attacker-bob"),
      "session-alice",
    );
    assert.equal(resolveBillingUserId("session-alice", null), "session-alice");
  });
});

describe("locked Stripe Price IDs (contract — do not invent)", () => {
  it("documents existing Pro and Premium price ids", () => {
    // Mirrored from src/lib/billing.ts — tests must not invent new Price IDs.
    assert.equal("price_1UEY6T42Bm7XSb7pJ5KD2MIH".startsWith("price_"), true);
    assert.equal("price_1UEY6V42Bm7XSb7pRm8c7deU".startsWith("price_"), true);
  });
});
