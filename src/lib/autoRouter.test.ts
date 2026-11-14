import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseModelForRequest } from "./autoRouter";

test("라우터 분류 호출은 maxTokens 2048", async (t) => {
  let sent: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response('data: {"choices":[{"delta":{"content":"openai/gpt-oss-20b:free"}}]}\n\ndata: [DONE]\n\n');
  });
  const picked = await chooseModelForRequest(
    [
      { id: "openai/gpt-oss-120b:free", name: "A" },
      { id: "openai/gpt-oss-20b:free", name: "B" },
    ],
    "안녕",
    false,
    new AbortController().signal,
  );
  assert.equal(picked, "openai/gpt-oss-20b:free");
  assert.equal(sent.model, "nvidia/nemotron-nano-9b-v2:free");
  assert.equal(sent.maxTokens, 2048);
});
