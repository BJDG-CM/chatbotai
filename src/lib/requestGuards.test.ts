import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMutationRequest } from "./requestGuards";

const ORIGIN = "https://chatbot.yejunlee.com";
const req = (method: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/chat`, { method, headers });

test("같은 출처 JSON 통과(파라미터·대소문자 무시)", () => {
  assert.equal(
    checkMutationRequest(req("POST", { Origin: ORIGIN, "Content-Type": "application/json" }), { json: true }),
    null,
  );
  assert.equal(
    checkMutationRequest(req("POST", { Origin: ORIGIN, "Content-Type": "Application/JSON; charset=utf-8" }), {
      json: true,
    }),
    null,
  );
});

test("Origin 없음·다름·null·스킴 다름 → 403 (POST/PUT/PATCH/DELETE)", async () => {
  for (const o of [undefined, "https://evil.example", "null", "http://chatbot.yejunlee.com"])
    for (const m of ["POST", "PUT", "PATCH", "DELETE"])
      assert.equal(
        checkMutationRequest(req(m, { "Content-Type": "application/json", ...(o ? { Origin: o } : {}) }), {
          json: true,
        })?.status,
        403,
      );
  const res = checkMutationRequest(req("POST"), { json: true });
  assert.equal(res?.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res?.json(), { error: "허용되지 않은 요청입니다." });
});

test("JSON 라우트: 다르거나 없는 Content-Type → 415, Origin 검사가 먼저", () => {
  assert.equal(
    checkMutationRequest(req("POST", { Origin: ORIGIN, "Content-Type": "text/plain" }), { json: true })?.status,
    415,
  );
  assert.equal(checkMutationRequest(req("POST", { Origin: ORIGIN }), { json: true })?.status, 415);
  assert.equal(
    checkMutationRequest(req("POST", { Origin: "https://evil.example", "Content-Type": "text/plain" }), {
      json: true,
    })?.status,
    403,
  );
});

test("json:false(로그아웃)는 Content-Type 무관, GET/HEAD는 검사 안 함", () => {
  assert.equal(checkMutationRequest(req("POST", { Origin: ORIGIN }), { json: false }), null);
  assert.equal(checkMutationRequest(req("GET"), { json: true }), null);
  assert.equal(checkMutationRequest(req("HEAD"), { json: true }), null);
});
