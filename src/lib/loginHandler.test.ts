import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleLogin, type LoginAttempt } from "./loginHandler";
import { applyLoginAttempt, type FailureCounter, type GuardState } from "./loginGuardPolicy";
import {
  createSessionToken,
  createTrustedDeviceToken,
  verifySessionToken,
  verifyTrustedDeviceToken,
} from "./session";

Object.assign(process.env, {
  NODE_ENV: "production",
  CHATBOT_USERNAME: "owner",
  CHATBOT_PASSWORD: "test-password",
  CHATBOT_SESSION_SECRET: "s".repeat(32),
});

const ORIGIN = "https://chatbot.yejunlee.com";
const DAY = 86_400_000;

function loginRequest(password: string, options: { trustedCookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = {
    Origin: options.origin ?? ORIGIN,
    "Content-Type": "application/json",
    "cf-connecting-ip": "203.0.113.9",
  };
  if (options.trustedCookie !== undefined) headers.Cookie = `chatbotai_trusted_device=${options.trustedCookie}`;
  return new NextRequest(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: "owner", password }),
  });
}

// 실제 정책으로 판정하는 메모리 가드. 호출마다 IP와 신뢰 기기 여부를 남긴다.
function memoryGuard(initial: Partial<GuardState> = {}) {
  let state: GuardState = { ip: null, global: null, trusted: null, ...initial };
  const calls: { ip: string; trustedDevice: boolean }[] = [];
  const attempt: LoginAttempt = async (ip, credentialsValid, trustedDevice) => {
    calls.push({ ip, trustedDevice });
    const { outcome, next } = applyLoginAttempt(state, credentialsValid, Date.now(), trustedDevice);
    state = next;
    return outcome;
  };
  return { attempt, calls };
}

const blockedFor = (ms: number): FailureCounter => ({ failures: [], blockedUntil: Date.now() + ms });

// Set-Cookie를 이름별 { value, attributes(소문자) }로 나눈다.
function setCookies(res: Response) {
  return new Map(
    res.headers.getSetCookie().map((header) => {
      const [pair, ...attributes] = header.split(";").map((part) => part.trim());
      const eq = pair.indexOf("=");
      return [
        pair.slice(0, eq),
        { value: decodeURIComponent(pair.slice(eq + 1)), attributes: attributes.map((a) => a.toLowerCase()) },
      ];
    }),
  );
}

test("성공하면 세션 쿠키와 90일 신뢰 기기 쿠키를 함께 발급", async () => {
  const guard = memoryGuard();
  const res = await handleLogin(loginRequest("test-password"), guard.attempt);
  assert.equal(res.status, 200);
  assert.deepEqual(guard.calls, [{ ip: "203.0.113.9", trustedDevice: false }]);

  const cookies = setCookies(res);
  const session = cookies.get("chatbotai_session");
  assert.ok(session);
  assert.equal(verifySessionToken(session.value), true);
  for (const attribute of ["httponly", "secure", "samesite=strict", "path=/", "max-age=604800"]) {
    assert.ok(session.attributes.includes(attribute), `session ${attribute}`);
  }

  const trusted = cookies.get("chatbotai_trusted_device");
  assert.ok(trusted);
  assert.equal(verifyTrustedDeviceToken(trusted.value), true);
  assert.equal(verifySessionToken(trusted.value), false);
  for (const attribute of ["httponly", "secure", "samesite=strict", "path=/api/auth/login", "max-age=7776000"]) {
    assert.ok(trusted.attributes.includes(attribute), `trusted ${attribute}`);
  }
});

test("전역 정지 중에는 유효한 신뢰 쿠키만 통과", async () => {
  const valid = createTrustedDeviceToken("owner");
  const [encoded, signature] = valid.split(".");
  const rejected: [string, string | undefined][] = [
    ["쿠키 없음", undefined],
    ["서명 위조", `${encoded}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`],
    ["만료", createTrustedDeviceToken("owner", Date.now() - 91 * DAY)],
    ["세션 토큰", createSessionToken("owner")],
  ];
  for (const [label, cookie] of rejected) {
    const guard = memoryGuard({ global: blockedFor(60 * 60_000) });
    const res = await handleLogin(loginRequest("test-password", { trustedCookie: cookie }), guard.attempt);
    assert.equal(res.status, 429, label);
    assert.deepEqual(guard.calls.map((call) => call.trustedDevice), [false], label);
    assert.deepEqual(res.headers.getSetCookie(), [], label);
  }

  const guard = memoryGuard({ global: blockedFor(60 * 60_000) });
  const res = await handleLogin(loginRequest("test-password", { trustedCookie: valid }), guard.attempt);
  assert.equal(res.status, 200);
  assert.deepEqual(guard.calls.map((call) => call.trustedDevice), [true]);
});

test("틀린 비밀번호는 신뢰 쿠키가 있어도 401이고 쿠키를 주지 않음", async () => {
  const guard = memoryGuard({ global: blockedFor(60 * 60_000) });
  const res = await handleLogin(
    loginRequest("wrong-password", { trustedCookie: createTrustedDeviceToken("owner") }),
    guard.attempt,
  );
  assert.equal(res.status, 401);
  assert.deepEqual(guard.calls.map((call) => call.trustedDevice), [true]);
  assert.deepEqual(res.headers.getSetCookie(), []);
});

test("IP 차단과 가드 오류에는 쿠키를 주지 않음", async (t) => {
  const guard = memoryGuard({ ip: blockedFor(15 * 60_000) });
  const blocked = await handleLogin(
    loginRequest("test-password", { trustedCookie: createTrustedDeviceToken("owner") }),
    guard.attempt,
  );
  assert.equal(blocked.status, 429);
  assert.deepEqual(blocked.headers.getSetCookie(), []);

  t.mock.method(console, "error", () => undefined);
  const unavailable = await handleLogin(loginRequest("test-password"), async () => {
    throw new Error("binding missing");
  });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.headers.getSetCookie(), []);
});

test("다른 출처 요청은 가드를 부르지 않음", async () => {
  const guard = memoryGuard();
  const res = await handleLogin(loginRequest("test-password", { origin: "https://evil.example" }), guard.attempt);
  assert.equal(res.status, 403);
  assert.deepEqual(guard.calls, []);
});
