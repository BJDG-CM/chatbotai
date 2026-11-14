import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChatRequest, resolveMaxTokens } from "./chatRequest";

const MiB = 1024 * 1024,
  user = (content: unknown) => ({ role: "user", content });
const img = (bytes: number) => ({
  type: "image_url",
  image_url: { url: `data:image/png;base64,${Buffer.alloc(bytes).toString("base64")}` },
});
const parse = (patch: Record<string, unknown>, env: { capEnv?: string; extraModelsEnv?: string } = {}) =>
  parseChatRequest({ model: "openai/gpt-oss-120b:free", messages: [user("hi")], ...patch }, env);
const error = (patch: Record<string, unknown>) => {
  const r = parse(patch);
  return r.ok ? "" : r.error;
};

test("모델: 카탈로그 ∪ 기본 목록 ∪ auto id ∪ CHAT_EXTRA_MODEL_IDS만", () => {
  for (const model of ["anthropic/claude-haiku-4.5", "qwen/qwen3-coder:free", "auto/router", "auto/free-router"])
    assert.equal(parse({ model }).ok, true);
  assert.match(error({ model: "openai/not-a-model" }), /지원하지 않는 모델/);
  assert.match(error({ model: "" }), /model과 messages/);
  assert.equal(parse({ model: "me/custom-1" }, { extraModelsEnv: " me/custom-1 , me/custom-2 " }).ok, true);
});

test("메시지 200개·역할·형식", () => {
  const many = (n: number) => Array.from({ length: n }, () => user("x"));
  assert.equal(parse({ messages: many(200) }).ok, true);
  assert.match(error({ messages: many(201) }), /대화가 너무 깁니다/);
  for (const m of [
    { role: "tool", content: "x" },
    user(42),
    user([{ type: "image_url", image_url: { url: "https://example.com/a.png" } }]),
  ])
    assert.match(error({ messages: [m] }), /잘못된 메시지 형식/);
});

test("이미지: 메시지당 3개, 각 4MiB(디코딩 기준), 히스토리 이미지는 메시지별로 셈", () => {
  assert.equal(parse({ messages: [user([img(1), img(1), img(1)])] }).ok, true);
  assert.equal(
    parse({ messages: [user([img(1), img(1)]), { role: "assistant", content: "ok" }, user([img(1), img(1)])] }).ok,
    true,
  );
  assert.match(error({ messages: [user([img(1), img(1), img(1), img(1)])] }), /최대 3개/);
  assert.equal(parse({ messages: [user([img(4 * MiB)])] }).ok, true);
  assert.match(error({ messages: [user([img(4 * MiB + 1)])] }), /4MB/);
});

test("max_tokens: 없으면 4096, CHAT_MAX_OUTPUT_TOKENS(기본 16384)로 클램프", () => {
  for (const bad of [undefined, null, 0, -1, "100", Number.NaN]) assert.equal(resolveMaxTokens(bad, undefined), 4096);
  assert.equal(resolveMaxTokens(32, undefined), 32);
  assert.equal(resolveMaxTokens(100000, undefined), 16384);
  assert.equal(resolveMaxTokens(100000, "8000"), 8000);
  assert.equal(resolveMaxTokens(undefined, "2000"), 2000);
  assert.equal(resolveMaxTokens(100000, "abc"), 16384);
});

test("업스트림 본문은 검증된 필드만", () => {
  const r = parse({ messages: [{ role: "user", content: "hi", name: "x" }], topP: 0.9 });
  assert.ok(r.ok);
  assert.deepEqual(r.upstream, {
    model: "openai/gpt-oss-120b:free",
    messages: [user("hi")],
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 0.9,
    stream: true,
  });
});

test("실제 클라이언트 페이로드 허용", () => {
  const r = parse({
    messages: [{ role: "system", content: "be brief" }, user([img(1)]), { role: "assistant", content: "" }, user("again")],
  });
  assert.equal(r.ok, true);
});
