import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anthropicDataToOpenAi,
  buildChatFetch,
  chatEndpoint,
  isOpenAiCompatible,
  ownerKeyEnvNames,
  providerForAgentId,
  resolveLeadRouting,
  resolveModel,
  resolveOwnerKey,
} from "./providers.ts";

test("providerForAgentId maps catalog ids/brands to providers", () => {
  assert.equal(providerForAgentId("claude"), "anthropic");
  assert.equal(providerForAgentId("claude-verifier"), "anthropic");
  assert.equal(providerForAgentId("chatgpt"), "openai");
  assert.equal(providerForAgentId("gemini"), "google");
  assert.equal(providerForAgentId("gemini-verifier"), "google");
  assert.equal(providerForAgentId("grok"), "xai");
  assert.equal(providerForAgentId("grok-architect"), "xai");
  // Unknown / open-weight seats route via the xAI-compatible default.
  assert.equal(providerForAgentId("mistral"), "xai");
});

test("resolveOwnerKey tries flexible env names", () => {
  assert.equal(resolveOwnerKey("openai", { OPENAI_API_KEY: "sk-a" }), "sk-a");
  assert.equal(resolveOwnerKey("openai", { CHATGPT_API_KEY: "sk-b" }), "sk-b");
  assert.equal(resolveOwnerKey("google", { GOOGLE_API_KEY: "g-1" }), "g-1");
  assert.equal(resolveOwnerKey("anthropic", { CLAUDE_API_KEY: "c-1" }), "c-1");
  assert.equal(resolveOwnerKey("xai", { GROK_API_KEY: "x-1" }), "x-1");
  assert.equal(resolveOwnerKey("openai", {}), undefined);
  // whitespace-only is treated as unset
  assert.equal(resolveOwnerKey("openai", { OPENAI_API_KEY: "   " }), undefined);
});

test("ownerKeyEnvNames lists the accepted names", () => {
  assert.ok(ownerKeyEnvNames("google").includes("GEMINI_API_KEY"));
  assert.ok(ownerKeyEnvNames("anthropic").includes("ANTHROPIC_API_KEY"));
});

test("resolveModel returns a flagship default, overridable by env", () => {
  assert.equal(resolveModel("xai", {}), "grok-4.6");
  assert.equal(resolveModel("openai", {}), "gpt-6-astra");
  assert.equal(resolveModel("google", {}), "gemini-3.8-flash");
  assert.equal(resolveModel("anthropic", {}), "claude-opus-5");
  assert.equal(resolveModel("openai", { MESH_MODEL_OPENAI: "gpt-x" }), "gpt-x");
  assert.equal(resolveModel("google", { MESH_MODEL_GOOGLE: "gemini-x" }), "gemini-x");
  assert.equal(resolveModel("xai", { MESH_MODEL_XAI: "grok-9" }), "grok-9");
});

test("endpoints + compatibility", () => {
  assert.equal(isOpenAiCompatible("openai"), true);
  assert.equal(isOpenAiCompatible("google"), true);
  assert.equal(isOpenAiCompatible("xai"), true);
  assert.equal(isOpenAiCompatible("anthropic"), false);
  assert.match(chatEndpoint("google"), /generativelanguage\.googleapis\.com/);
  assert.match(chatEndpoint("anthropic"), /api\.anthropic\.com\/v1\/messages/);
});

test("buildChatFetch shapes OpenAI requests (max_completion_tokens, no temperature)", () => {
  const f = buildChatFetch({
    provider: "openai",
    apiKey: "sk-1",
    model: "gpt-x",
    system: "SYS",
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 100,
    temperature: 0.2,
  });
  assert.equal(f.headers.Authorization, "Bearer sk-1");
  const body = JSON.parse(f.body);
  assert.equal(body.model, "gpt-x");
  assert.equal(body.stream, true);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].content, "hi");
  assert.equal(body.max_completion_tokens, 100);
  assert.equal("max_tokens" in body, false);
  assert.equal("temperature" in body, false);
});

test("buildChatFetch keeps classic sampling only for xAI", () => {
  const xai = JSON.parse(
    buildChatFetch({
      provider: "xai",
      apiKey: "x",
      model: "grok",
      system: "S",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
      temperature: 0.5,
    }).body,
  );
  assert.equal(xai.max_tokens, 50);
  assert.equal(xai.temperature, 0.5);

  const google = JSON.parse(
    buildChatFetch({
      provider: "google",
      apiKey: "g",
      model: "gemini",
      system: "S",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 50,
      temperature: 0.5,
    }).body,
  );
  assert.equal(google.max_tokens, 50);
  assert.equal("temperature" in google, false);
});

test("buildChatFetch shapes Anthropic requests (system out of messages)", () => {
  const f = buildChatFetch({
    provider: "anthropic",
    apiKey: "c-1",
    model: "claude-x",
    system: "SYS",
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 100,
    temperature: 0.2,
  });
  assert.equal(f.headers["x-api-key"], "c-1");
  assert.equal(f.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(f.body);
  assert.equal(body.system, "SYS");
  assert.equal(body.messages.length, 1);
  assert.equal(body.max_tokens, 100);
});

test("anthropicDataToOpenAi translates text deltas and drops the rest", () => {
  const chunk = anthropicDataToOpenAi(
    JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } }),
  );
  assert.ok(chunk);
  assert.match(chunk, /^data: /);
  const parsed = JSON.parse(chunk.replace(/^data: /, "").trim());
  assert.equal(parsed.choices[0].delta.content, "Hello");

  assert.equal(anthropicDataToOpenAi("[DONE]"), null);
  assert.equal(anthropicDataToOpenAi(JSON.stringify({ type: "message_start" })), null);
  assert.equal(anthropicDataToOpenAi("not json"), null);
  assert.equal(anthropicDataToOpenAi(""), null);
});

test("resolveLeadRouting returns a route only with key + model, else fallback", () => {
  // xAI lead always falls back to the existing xAI path
  assert.equal(resolveLeadRouting("grok", {}).kind, "fallback");

  // openai lead with just a key → real route on the flagship default (no env model needed)
  const dflt = resolveLeadRouting("chatgpt", { OPENAI_API_KEY: "sk" });
  assert.equal(dflt.kind, "provider");
  if (dflt.kind === "provider") assert.equal(dflt.model, "gpt-6-astra");

  // env override wins
  const r = resolveLeadRouting("chatgpt", { OPENAI_API_KEY: "sk", MESH_MODEL_OPENAI: "gpt-x" });
  assert.equal(r.kind, "provider");
  if (r.kind === "provider") {
    assert.equal(r.provider, "openai");
    assert.equal(r.model, "gpt-x");
    assert.equal(r.apiKey, "sk");
  }

  // gemini lead with just a key → real route
  assert.equal(resolveLeadRouting("gemini", { GEMINI_API_KEY: "g" }).kind, "provider");

  // anthropic lead missing key → fallback (no key = cannot route)
  assert.equal(resolveLeadRouting("claude", { MESH_MODEL_ANTHROPIC: "claude-x" }).kind, "fallback");
});
