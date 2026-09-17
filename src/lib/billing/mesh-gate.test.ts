import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideMeshFunding,
  MeshPaymentRequiredError,
  MESH_STUDIO_TURN_CENTS,
} from "./mesh-gate.server.ts";

describe("MESH_STUDIO_TURN_CENTS", () => {
  it("exports floor default of 1 (not a catalog SKU)", () => {
    assert.equal(MESH_STUDIO_TURN_CENTS, 1);
  });
});

describe("decideMeshFunding (pure, xAI-scoped)", () => {
  it("allows when credits > 0 and no xAI BYOK", () => {
    const d = decideMeshFunding(100, false);
    assert.equal(d.allow, true);
    assert.equal(d.creditCents, 100);
    assert.equal(d.hasByokXai, false);
  });

  it("allows when credits = 0 but hasByokXai=true (decrypt still required at route)", () => {
    const d = decideMeshFunding(0, true);
    assert.equal(d.allow, true);
    assert.equal(d.creditCents, 0);
    assert.equal(d.hasByokXai, true);
  });

  it("allows when both credits and hasByokXai", () => {
    const d = decideMeshFunding(50, true);
    assert.equal(d.allow, true);
  });

  it("denies when credits = 0 and hasByokXai=false", () => {
    const d = decideMeshFunding(0, false);
    assert.equal(d.allow, false);
    assert.equal(d.creditCents, 0);
    assert.equal(d.hasByokXai, false);
  });

  it("credits=0 + hasByokXai=false denies even if caller had non-xAI BYOK (gate is xAI-scoped)", () => {
    // Non-xAI BYOK (openai/anthropic) must NOT authorize owner-key mesh.
    // Callers pass hasByokXai=false when only openai/anthropic rows exist.
    const d = decideMeshFunding(0, false);
    assert.equal(d.allow, false);
  });

  it("treats negative / non-finite credits as 0", () => {
    assert.equal(decideMeshFunding(-5, false).allow, false);
    assert.equal(decideMeshFunding(Number.NaN, false).allow, false);
    assert.equal(decideMeshFunding(-5, true).allow, true);
  });
});

describe("MeshPaymentRequiredError contract", () => {
  it("carries 402 PAYMENT_REQUIRED with details fields", () => {
    const err = new MeshPaymentRequiredError({
      creditCents: 0,
      hasByok: false,
    });
    assert.equal(err.code, "PAYMENT_REQUIRED");
    assert.equal(err.status, 402);
    assert.equal(err.creditCents, 0);
    assert.equal(err.hasByok, false);
    assert.ok(err.message.length > 0);
  });
});
