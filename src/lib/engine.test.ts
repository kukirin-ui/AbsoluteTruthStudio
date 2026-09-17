import assert from "node:assert/strict";
import { test } from "node:test";
import { PROVIDER_TIERS, TIER_ORDER } from "./tiers.ts";
import {
  DISPLAY_TIER_ORDER,
  MODEL_CATALOG,
  ROLE_TO_SEAT,
  ceilingForPlan,
  clampStoredSeatModels,
  effectiveSeatModelId,
  highestAllowedModel,
  isTierUnlocked,
  meshProviderId,
  modelsInTier,
  resolveAllowedModel,
  resolveSeatModel,
  resolvedSeatModelId,
  userContextForPlan,
  type SeatState,
} from "./engine.ts";

test("resolvedSeatModelId prefers an explicit id, then a stored tier", () => {
  const free = userContextForPlan("free", false);
  assert.equal(resolvedSeatModelId("gpt-6-astra", null, free, "OpenAI"), "gpt-5.6-luna");
  assert.equal(resolvedSeatModelId(null, "basic", free, "Anthropic"), "claude-haiku-4-5");
  const pro = userContextForPlan("pro", false);
  assert.equal(resolvedSeatModelId(null, null, pro, "Anthropic"), "claude-opus-5");
});

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

test("role ↔ seat mapping matches the four-agent matrix", () => {
  assert.equal(ROLE_TO_SEAT.architecture, "architect");
  assert.equal(ROLE_TO_SEAT.verifier, "security");
  assert.deepEqual(DISPLAY_TIER_ORDER, ["max", "high", "standard", "basic"]);
});

test("isTierUnlocked respects plan ceiling; owners see every tier", () => {
  const free = userContextForPlan("free", false);
  assert.equal(isTierUnlocked("basic", free), true);
  assert.equal(isTierUnlocked("high", free), false);
  assert.equal(isTierUnlocked("max", { isOwner: true, plan: "basic" }), true);
});

test("modelsInTier lists catalog entries for that ceiling rung", () => {
  const basic = modelsInTier("basic").map((m) => m.id).sort();
  assert.ok(basic.includes("claude-haiku-4-5"));
  assert.ok(basic.includes("gpt-5.6-luna"));
  assert.equal(modelsInTier("max").some((m) => m.id === "gpt-6-astra"), true);
});

test("highestAllowedModel is the plan ceiling for that provider", () => {
  const free = userContextForPlan("free", false);
  assert.equal(highestAllowedModel("OpenAI", free).id, "gpt-5.6-luna");
  const pro = userContextForPlan("pro", false);
  assert.equal(highestAllowedModel("Anthropic", pro).id, "claude-opus-5");
  const owner = { isOwner: true, plan: "basic" as const };
  assert.equal(highestAllowedModel("OpenAI", owner).id, "gpt-6-astra");
});

test("effectiveSeatModelId auto-picks the ceiling; stored ids still clamp", () => {
  const free = userContextForPlan("free", false);
  assert.equal(effectiveSeatModelId(null, free, "Anthropic").allowedModelId, "claude-haiku-4-5");
  const clamped = effectiveSeatModelId("gpt-6-astra", free, "OpenAI");
  assert.equal(clamped.wasClamped, true);
  assert.equal(clamped.allowedModelId, "gpt-5.6-luna");
});

test("clampStoredSeatModels never leaves a visitor above the ceiling", () => {
  const free = userContextForPlan("free", false);
  const next = clampStoredSeatModels(
    { architect: "claude-fable-5-1", visual: null, coder: "gpt-6-astra", security: "not-a-model" },
    free,
  );
  assert.equal(next.architect, "claude-haiku-4-5");
  assert.equal(next.coder, "gpt-5.6-luna");
  assert.equal(next.security, null);
  assert.equal(next.visual, null);
});

test("meshProviderId maps catalog labels onto mesh providers", () => {
  assert.equal(meshProviderId("Anthropic"), "anthropic");
  assert.equal(meshProviderId("OpenAI"), "openai");
  assert.equal(meshProviderId("Google"), "google");
  assert.equal(meshProviderId("xAI"), "xai");
});
