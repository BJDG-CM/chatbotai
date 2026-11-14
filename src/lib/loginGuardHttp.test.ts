import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, loginGuardResponse, loginGuardUnavailableResponse } from "./loginGuardHttp";

test("blocked → 429 + Retry-After(초) + 올림한 분 안내", async () => {
  for (const [s, min] of [
    [900, 15],
    [3600, 60],
    [61, 2],
  ] as const) {
    const res = loginGuardResponse({ status: "blocked", scope: "ip", retryAfterSeconds: s });
    assert.ok(res);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), String(s));
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(((await res.json()) as { error: string }).error, new RegExp(`${min}분 후`));
  }
});

test("invalid → 401 기존 문구, allowed → null, 가드 오류 → 503", async () => {
  const res = loginGuardResponse({ status: "invalid" });
  assert.equal(res?.status, 401);
  assert.deepEqual(await res?.json(), { error: "사용자명 또는 비밀번호가 올바르지 않습니다." });
  assert.equal(loginGuardResponse({ status: "allowed" }), null);
  assert.equal(loginGuardUnavailableResponse().status, 503);
});

test("IP는 cf-connecting-ip만 신뢰", () => {
  const ip = (h: Record<string, string>) =>
    clientIp(new Request("https://chatbot.yejunlee.com/api/auth/login", { headers: h }));
  assert.equal(ip({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }), "203.0.113.7");
  assert.equal(ip({ "x-forwarded-for": "198.51.100.1" }), "unknown");
});
