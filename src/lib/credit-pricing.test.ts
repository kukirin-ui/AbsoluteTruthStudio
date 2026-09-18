import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCredits,
  calculateSubscriptionGrant,
  creditsToEuroDisplay,
  creditsToWalletCents,
  estimateTurnsForAmount,
  getMarkupTier,
  parseTopUpMetadata,
  validateMargin,
  walletCentsToCredits,
} from "./credit-pricing.ts";

describe("getMarkupTier", () => {
  it("uses 3.5× below €30", () => {
    assert.equal(getMarkupTier(10), 3.5);
    assert.equal(getMarkupTier(29.99), 3.5);
  });

  it("uses 3.0× from €30 up to €99", () => {
    assert.equal(getMarkupTier(30), 3.0);
    assert.equal(getMarkupTier(99), 3.0);
  });

  it("uses 2.5× from €100", () => {
    assert.equal(getMarkupTier(100), 2.5);
    assert.equal(getMarkupTier(10000), 2.5);
  });
});

describe("calculateCredits", () => {
  it("awards 10,000 credits for €10 and splits API budget at 3.5×", () => {
    const result = calculateCredits(10);
    assert.equal(result.creditsAwarded, 10000);
    assert.equal(result.markupTier, 3.5);
    assert.equal(result.margin, 3.5);
    assert.equal(result.apiBudgetCost, 10 / 3.5);
    assert.equal(result.profitMargin, 10 - 10 / 3.5);
  });

  it("awards 50,000 credits for €50 at 3.0×", () => {
    const result = calculateCredits(50);
    assert.equal(result.creditsAwarded, 50000);
    assert.equal(result.markupTier, 3.0);
    assert.equal(result.apiBudgetCost, 50 / 3.0);
  });

  it("awards 100,000 credits for €100 at 2.5×", () => {
    const result = calculateCredits(100);
    assert.equal(result.creditsAwarded, 100000);
    assert.equal(result.markupTier, 2.5);
    assert.equal(result.apiBudgetCost, 100 / 2.5);
    assert.equal(result.profitMargin, 100 - 40);
  });

  it("rejects amounts under €10", () => {
    assert.throws(() => calculateCredits(9.99), /Minimum top-up is €10/);
  });

  it("rejects amounts over €10,000", () => {
    assert.throws(() => calculateCredits(10000.01), /Maximum top-up is €10,000/);
  });

  it("meets the 2.5× margin floor on every published tier", () => {
    for (const amount of [10, 30, 100]) {
      assert.equal(validateMargin(calculateCredits(amount)), true);
    }
  });
});

describe("wallet conversion", () => {
  it("maps 1000 credits to 100 cents (€1)", () => {
    assert.equal(creditsToWalletCents(1000), 100);
    assert.equal(walletCentsToCredits(100), 1000);
    assert.equal(creditsToEuroDisplay(1000), 1);
  });

  it("maps a €10 top-up (10k credits) to 1,000 wallet cents", () => {
    assert.equal(creditsToWalletCents(10000), 1000);
  });
});

describe("calculateSubscriptionGrant", () => {
  it("awards 10% floored", () => {
    assert.equal(calculateSubscriptionGrant(10000), 1000);
    assert.equal(calculateSubscriptionGrant(15), 1);
    assert.equal(calculateSubscriptionGrant(9), 0);
  });
});

describe("estimateTurnsForAmount", () => {
  it("divides awarded credits by the ballpark cost-per-turn", () => {
    assert.equal(estimateTurnsForAmount(10, "Budget"), Math.floor(10000 / 200));
    assert.equal(estimateTurnsForAmount(10, "Balanced"), Math.floor(10000 / 435));
    assert.equal(estimateTurnsForAmount(10, "Flagship"), Math.floor(10000 / 775));
  });
});

describe("parseTopUpMetadata", () => {
  it("recalculates credits from amountEuros (ignores inflated creditsToGrant)", () => {
    const grant = parseTopUpMetadata({
      userId: "user_1",
      amountEuros: "10",
      creditsToGrant: "999999",
      markupTier: "1",
    });
    assert.deepEqual(grant, {
      userId: "user_1",
      amountEuros: 10,
      creditsToGrant: 10000,
      markupTier: 3.5,
      apiBudgetCost: 10 / 3.5,
    });
  });

  it("accepts user_id snake_case", () => {
    const grant = parseTopUpMetadata({
      user_id: "user_2",
      amountEuros: "100",
    });
    assert.equal(grant?.userId, "user_2");
    assert.equal(grant?.creditsToGrant, 100000);
    assert.equal(grant?.apiBudgetCost, 40);
  });

  it("returns null without a user id or grant", () => {
    assert.equal(parseTopUpMetadata({ amountEuros: "10" }), null);
    assert.equal(parseTopUpMetadata({ userId: "u" }), null);
    assert.equal(parseTopUpMetadata(null), null);
  });
});
