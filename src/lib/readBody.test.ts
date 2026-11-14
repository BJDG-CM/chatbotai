import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonBody } from "./readBody";

const enc = new TextEncoder();
function src(chunks: (string | Uint8Array)[], headers: Record<string, string> = {}) {
  const state = { cancelled: false };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) {
        const x = chunks[i++];
        c.enqueue(typeof x === "string" ? enc.encode(x) : x);
      } else c.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { req: { headers: new Headers(headers), body }, state };
}

test("한도 이내는 파싱, 정확히 4096바이트도 허용", async () => {
  assert.deepEqual(await readJsonBody(src(['{"a":1}']).req, 4096), { ok: true, value: { a: 1 } });
  assert.equal((await readJsonBody(src([JSON.stringify({ p: "a".repeat(4088) })]).req, 4096)).ok, true); // 4096 bytes
});

test("Content-Length 없이 스트리밍 중 초과 → 413, 스트림 취소", async () => {
  const { req, state } = src(Array.from({ length: 5 }, () => "a".repeat(2000)));
  assert.deepEqual(await readJsonBody(req, 4096), { ok: false, status: 413 });
  assert.equal(state.cancelled, true);
});

test("Content-Length가 한도를 넘으면 본문과 무관하게 413", async () => {
  assert.deepEqual(await readJsonBody(src(["{}"], { "content-length": "5000" }).req, 4096), {
    ok: false,
    status: 413,
  });
});

test("잘못된 JSON·빈 본문 → 400", async () => {
  assert.deepEqual(await readJsonBody(src(["{"]).req, 4096), { ok: false, status: 400 });
  assert.deepEqual(await readJsonBody({ headers: new Headers(), body: null }, 4096), { ok: false, status: 400 });
});

test("멀티바이트: 바이트로 세고 청크 경계에서 잘린 한글을 복원", async () => {
  assert.deepEqual(await readJsonBody(src([JSON.stringify({ u: "가".repeat(1400) })]).req, 4096), {
    ok: false,
    status: 413,
  }); // 4208 bytes
  const b = enc.encode('{"u":"가"}');
  assert.deepEqual(await readJsonBody(src([b.slice(0, 7), b.slice(7)]).req, 4096), {
    ok: true,
    value: { u: "가" },
  });
});
