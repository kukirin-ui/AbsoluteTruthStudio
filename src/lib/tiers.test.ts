import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampTierToPlan,
  defaultTierForPlan,
  everyProviderHasEveryTier,
  planCeilingTier,
  resolveMeshModel,
  tierOptionsForPlan,
  tiersForPlan,
} from "./tiers.ts";

test("plan ceilings: premium=max, pro=high, free=basic", () => {
  assert.equal(planCeilingTier("premium"), "max");
  assert.equal(planCeilingTier("pro"), "high");
  assert.equal(planCeilingTier("free"), "basic");
});

test("default tier is the plan ceiling", () => {
  assert.equal(defaultTierForPlan("premium"), "max");
  assert.equal(defaultTierForPlan("pro"), "high");
  assert.equal(defaultTierForPlan("free"), "basic");
});

test("tiersForPlan lists basic..ceiling (downgrade options)", () => {
  assert.deepEqual(tiersForPlan("free"), ["basic"]);
  assert.deepEqual(tiersForPlan("pro"), ["basic", "standard", "high"]);
  assert.deepEqual(tiersForPlan("premium"), ["basic", "standard", "high", "max"]);
});

test("clampTierToPlan never exceeds the plan ceiling", () => {
  assert.equal(clampTierToPlan("max", "free"), "basic");
  assert.equal(clampTierToPlan("max", "pro"), "high");
  assert.equal(clampTierToPlan("max", "premium"), "max");
  assert.equal(clampTierToPlan("standard", "premium"), "standard"); // downgrade honored
  assert.equal(clampTierToPlan("basic", "pro"), "basic");
});

test("resolveMeshModel maps plan+tier to exact model ids", () => {
  // Premium default = highest tier
  assert.equal(resolveMeshModel("anthropic", "premium", undefined, {}), "claude-fable-5-1");
  assert.equal(resolveMeshModel("openai", "premium", undefined, {}), "gpt-6-astra");
  // Pro default = a few below (Opus/Sol, not the very top)
  assert.equal(resolveMeshModel("anthropic", "pro", undefined, {}), "claude-opus-5");
  assert.equal(resolveMeshModel("openai", "pro", undefined, {}), "gpt-5.6-sol");
  // Free = basic
  assert.equal(resolveMeshModel("anthropic", "free", undefined, {}), "claude-haiku-4-5");
  assert.equal(resolveMeshModel("xai", "free", undefined, {}), "grok-4-fast");
});

test("resolveMeshModel honors a downgrade within the plan, clamps above it", () => {
  // Premium user downgrades Claude to standard
  assert.equal(resolveMeshModel("anthropic", "premium", "standard", {}), "claude-sonnet-5");
  // Free user asks for max → clamped to basic
  assert.equal(resolveMeshModel("openai", "free", "max", {}), "gpt-5.6-luna");
  // Pro user asks for max → clamped to high
  assert.equal(resolveMeshModel("openai", "pro", "max", {}), "gpt-5.6-sol");
});

test("MESH_MODEL_* env pin is owner-only and does not raise a visitor ceiling", () => {
  assert.equal(
    resolveMeshModel("anthropic", "free", "basic", { MESH_MODEL_ANTHROPIC: "claude-custom" }, true),
    "claude-custom",
  );
  assert.equal(
    resolveMeshModel("anthropic", "free", "max", { MESH_MODEL_ANTHROPIC: "claude-custom" }, false),
    "claude-haiku-4-5",
  );
});

test("owner bypasses the plan ceiling through resolveMeshModel", () => {
  assert.equal(resolveMeshModel("openai", "free", "max", {}, true), "gpt-6-astra");
  assert.equal(resolveMeshModel("openai", "free", "max", {}, false), "gpt-5.6-luna");
});

test("tierOptionsForPlan gives labeled, selectable options", () => {
  const pro = tierOptionsForPlan("anthropic", "pro");
  assert.deepEqual(
    pro.map((o) => o.label),
    ["Claude Haiku 4.5", "Claude Sonnet 5", "Claude Opus 5"],
  );
  assert.equal(pro.find((o) => o.isDefault)?.tier, "high");
  assert.equal(tierOptionsForPlan("openai", "premium").length, 4);
});

test("catalog completeness guard", () => {
  assert.equal(everyProviderHasEveryTier(), true);
});
