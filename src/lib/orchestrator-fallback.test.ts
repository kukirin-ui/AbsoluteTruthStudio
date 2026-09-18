import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_MODEL,
  MODEL_MAP,
  formatBanner,
  preferenceFromEngineTier,
  resolutionFromCredits,
} from "./orchestrator-fallback.ts";

describe("resolutionFromCredits", () => {
  it("forces Budget + banner at zero (or negative) balance", () => {
    const zero = resolutionFromCredits(0, "Flagship");
    assert.equal(zero.isZeroBalanceMode, true);
    assert.equal(zero.tier, "Budget");
    assert.equal(zero.primary, FALLBACK_MODEL);
    assert.equal(zero.fallback, FALLBACK_MODEL);
    assert.equal(zero.creditsRemaining, 0);
    assert.match(zero.banner ?? "", /credits are empty/i);

    const neg = resolutionFromCredits(-12, "Balanced");
    assert.equal(neg.isZeroBalanceMode, true);
  });

  it("keeps the requested tier when credits remain", () => {
    const r = resolutionFromCredits(12_000, "Flagship");
    assert.equal(r.isZeroBalanceMode, false);
    assert.equal(r.tier, "Flagship");
    assert.equal(r.primary, MODEL_MAP.Flagship);
    assert.equal(r.creditsRemaining, 12_000);
    assert.equal(r.banner, undefined);
  });
});

describe("formatBanner", () => {
  it("includes remaining credits on the zero-balance banner", () => {
    const text = formatBanner(resolutionFromCredits(0, "Balanced"));
    assert.ok(text);
    assert.match(text, /Credits: 0/);
  });

  it("warns when remaining credits are under 5000", () => {
    const text = formatBanner(resolutionFromCredits(4999, "Balanced"));
    assert.ok(text);
    assert.match(text, /Low balance/);
    assert.match(text, /4,999/);
  });

  it("is silent when the balance is healthy", () => {
    assert.equal(formatBanner(resolutionFromCredits(5000, "Balanced")), null);
    assert.equal(formatBanner(resolutionFromCredits(80_000, "Flagship")), null);
  });
});

describe("preferenceFromEngineTier", () => {
  it("maps engine tiers onto Budget / Balanced / Flagship", () => {
    assert.equal(preferenceFromEngineTier("basic"), "Budget");
    assert.equal(preferenceFromEngineTier("standard"), "Balanced");
    assert.equal(preferenceFromEngineTier("high"), "Flagship");
    assert.equal(preferenceFromEngineTier("max"), "Flagship");
    assert.equal(preferenceFromEngineTier(undefined), "Balanced");
  });
});
