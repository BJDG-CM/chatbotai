import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createSessionToken,
  createTrustedDeviceToken,
  verifySessionToken,
  verifyTrustedDeviceToken,
} from "./session";

const SECRET = "s".repeat(32);
Object.assign(process.env, {
  CHATBOT_USERNAME: "owner",
  CHATBOT_PASSWORD: "test-password",
  CHATBOT_SESSION_SECRET: SECRET,
});

const T0 = Date.UTC(2026, 10, 15),
  DAY = 86_400_000;

// 환경변수를 잠시 바꿔 실행하고 되돌린다.
function withEnv<T>(overrides: Record<string, string>, fn: () => T): T {
  const saved = Object.fromEntries(Object.keys(overrides).map((key) => [key, process.env[key] ?? ""]));
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    Object.assign(process.env, saved);
  }
}

test("신뢰 기기 토큰은 90일 동안만 유효", () => {
  const token = createTrustedDeviceToken("owner", T0);
  assert.equal(verifyTrustedDeviceToken(token, T0), true);
  assert.equal(verifyTrustedDeviceToken(token, T0 + 90 * DAY - 1000), true);
  assert.equal(verifyTrustedDeviceToken(token, T0 + 90 * DAY), false);
});

test("위조한 신뢰 기기 토큰은 무효", () => {
  const token = createTrustedDeviceToken("owner", T0);
  const [encoded, signature] = token.split(".");
  const iat = T0 / 1000;
  const extended = Buffer.from(JSON.stringify({ sub: "owner", iat, exp: iat + 3650 * 86_400 })).toString(
    "base64url",
  );
  const otherSecret = withEnv({ CHATBOT_SESSION_SECRET: "t".repeat(32) }, () =>
    createTrustedDeviceToken("owner", T0),
  );
  for (const forged of [
    `${encoded}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`,
    `${extended}.${signature}`,
    `${token}.extra`,
    encoded,
    "",
    undefined,
    otherSecret,
  ]) {
    assert.equal(verifyTrustedDeviceToken(forged, T0), false, String(forged));
  }
});

test("세션 토큰과 신뢰 기기 토큰은 서로 바꿔 쓸 수 없음", () => {
  assert.equal(verifyTrustedDeviceToken(createSessionToken("owner", T0), T0), false);
  assert.equal(verifySessionToken(createTrustedDeviceToken("owner", T0), T0), false);
});

test("사용자명이 바뀌면 신뢰 기기 토큰은 무효", () => {
  const token = createTrustedDeviceToken("owner", T0);
  assert.equal(
    withEnv({ CHATBOT_USERNAME: "someone-else" }, () => verifyTrustedDeviceToken(token, T0)),
    false,
  );
});

test("이미 발급된 세션 토큰 형식은 그대로 유효", () => {
  const iat = T0 / 1000;
  const encoded = Buffer.from(JSON.stringify({ sub: "owner", iat, exp: iat + 7 * 86_400 })).toString("base64url");
  const issued = `${encoded}.${createHmac("sha256", SECRET).update(encoded).digest("base64url")}`;
  assert.equal(verifySessionToken(issued, T0), true);
});
