import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SCALE_SETTLE_EVENTS,
  SESSION_COOKIE_NAME,
  isScaleSettleEvent,
  resolveBillingUserId,
} from "./scale-contract.ts";

describe("SCALE_SETTLE_EVENTS allowlist", () => {
  it("includes required settle events for Premium/Pro grants", () => {
    const required = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ];
    for (const event of required) {
      assert.equal(
        SCALE_SETTLE_EVENTS.includes(event as (typeof SCALE_SETTLE_EVENTS)[number]),
        true,
        `missing settle event: ${event}`,
      );
      assert.equal(isScaleSettleEvent(event), true);
    }
  });

  it("rejects unknown event types", () => {
    assert.equal(isScaleSettleEvent("charge.succeeded"), false);
    assert.equal(isScaleSettleEvent("customer.created"), false);
  });
});

describe("resolveBillingUserId IDOR guard", () => {
  it("always returns the session user id and ignores body.userId", () => {
    assert.equal(
      resolveBillingUserId("session-user-1", "attacker-user-9"),
      "session-user-1",
    );
    assert.equal(resolveBillingUserId("session-user-1", null), "session-user-1");
    assert.equal(resolveBillingUserId("session-user-1"), "session-user-1");
  });
});

describe("SESSION_COOKIE_NAME", () => {
  it("matches Better Auth __Host- session cookie", () => {
    assert.equal(SESSION_COOKIE_NAME, "__Host-grok-auth.session_token");
  });
});
