import assert from "node:assert/strict";
import { test } from "node:test";
import { PROVIDER_TIERS, TIER_ORDER } from "./tiers.ts";
import {
  MODEL_CATALOG,
  ceilingForPlan,
  resolveAllowedModel,
  resolveSeatModel,
  userContextForPlan,
  type SeatState,
} from "./engine.ts";

test("owner bypasses the ceiling, including unknown model ids", () => {
  const owner = { isOwner: true, plan: "basic" as const };
  assert.deepEqual(resolveAllowedModel("claude-fable-5-1", owner), {
    allowedModelId: "claude-fable-5-1",
    wasClamped: false,
  });
  assert.deepEqual(resolveAllowedModel("totally-custom-model", owner), {
    allowedModelId: "totally-custom-model",
    wasClamped: false,
  });
});

test("unknown model throws for non-owners", () => {
  assert.throws(
    () => resolveAllowedModel("not-a-model", { isOwner: false, plan: "max" }),
    /Unknown model requested: not-a-model/,
  );
});

test("free / basic ceiling clamps max-tier requests to the same provider's basic model", () => {
  const user = userContextForPlan("free", false);
  assert.equal(user.plan, "basic");
  const openai = resolveAllowedModel("gpt-6-astra", user);
  assert.equal(openai.allowedModelId, "gpt-5.6-luna");
  assert.equal(openai.wasClamped, true);
  assert.match(openai.reason ?? "", /personal API key/);

  const anthropic = resolveAllowedModel("claude-fable-5-1", user);
  assert.equal(anthropic.allowedModelId, "claude-haiku-4-5");
  assert.equal(anthropic.wasClamped, true);
});

test("pro / high ceiling allows high, clamps max", () => {
  const user = userContextForPlan("pro", false);
  assert.equal(user.plan, "high");
  const allowed = resolveAllowedModel("claude-opus-5", user);
  assert.equal(allowed.wasClamped, false);
  assert.equal(allowed.allowedModelId, "claude-opus-5");

  const clamped = resolveAllowedModel("gpt-6-astra", user);
  assert.equal(clamped.wasClamped, true);
  assert.equal(clamped.allowedModelId, "gpt-5.6-sol");
});

test("premium / max ceiling allows every catalog model", () => {
  const user = userContextForPlan("premium", false);
  assert.equal(user.plan, "max");
  for (const id of Object.keys(MODEL_CATALOG)) {
    const result = resolveAllowedModel(id, user);
    assert.equal(result.wasClamped, false);
    assert.equal(result.allowedModelId, id);
  }
});

test("BYOK on a seat does not raise the plan ceiling", () => {
  const free = userContextForPlan("free", false);
  const seat: SeatState = {
    role: "coder",
    selectedModelId: "gpt-6-astra",
    hasBYOK: true,
    byokProvider: "OpenAI",
  };
  const result = resolveSeatModel(seat, free);
  assert.equal(result.wasClamped, true);
  assert.equal(result.allowedModelId, "gpt-5.6-luna");
});

test("ceilingForPlan matches billed plans", () => {
  assert.equal(ceilingForPlan("free"), "basic");
  assert.equal(ceilingForPlan("pro"), "high");
  assert.equal(ceilingForPlan("premium"), "max");
});

test("MODEL_CATALOG covers every provider-tier slot", () => {
  for (const provider of Object.keys(PROVIDER_TIERS) as (keyof typeof PROVIDER_TIERS)[]) {
    for (const tier of TIER_ORDER) {
      const id = PROVIDER_TIERS[provider][tier].model;
      assert.ok(MODEL_CATALOG[id], `missing catalog entry for ${provider}/${tier} (${id})`);
    }
  }
});
