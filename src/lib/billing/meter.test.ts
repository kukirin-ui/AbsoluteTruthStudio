import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveBillingUserId } from "../auth/scale-contract.ts";
import { InsufficientBufferError } from "./meter.server.ts";

describe("meter IDOR + InsufficientBufferError contract", () => {
  it("resolveBillingUserId never honors client body.userId", () => {
    assert.equal(
      resolveBillingUserId("real-user", "spoofed-user"),
      "real-user",
    );
  });

  it("InsufficientBufferError carries 402 code and remaining balances", () => {
    const err = new InsufficientBufferError({
      requestedCents: 100,
      bufferCentsRemaining: 10,
      creditCents: 5,
    });
    assert.equal(err.code, "INSUFFICIENT_BUFFER");
    assert.equal(err.status, 402);
    assert.equal(err.requestedCents, 100);
    assert.equal(err.bufferCentsRemaining, 10);
    assert.equal(err.creditCents, 5);
  });
});
