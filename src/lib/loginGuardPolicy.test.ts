import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLoginAttempt, counterExpiresAt, type FailureCounter } from "./loginGuardPolicy";

const T0 = Date.UTC(2026, 10, 15),
  MIN = 60_000;
const blocked = (scope: "ip" | "global", retryAfterSeconds: number) => ({
  status: "blocked",
  scope,
  retryAfterSeconds,
});

// IP별 카운터, 글로벌 카운터, 신뢰 기기 카운터를 들고 있는 테스트용 저장소
function guard() {
  const ips = new Map<string, FailureCounter | null>();
  let global: FailureCounter | null = null;
  let trusted: FailureCounter | null = null;
  return (ip: string, valid: boolean, now: number, trustedDevice = false) => {
    const { outcome, next } = applyLoginAttempt(
      { ip: ips.get(ip) ?? null, global, trusted },
      valid,
      now,
      trustedDevice,
    );
    ips.set(ip, next.ip);
    global = next.global;
    trusted = next.trusted;
    return outcome;
  };
}

test("IP 5회 실패(모두 invalid) 뒤 15분 차단, 다른 IP와 만료 후는 허용", () => {
  const a = guard();
  for (let i = 0; i < 5; i++) assert.deepEqual(a("a", false, T0), { status: "invalid" });
  assert.deepEqual(a("a", true, T0 + 1), blocked("ip", 900));
  assert.deepEqual(a("b", true, T0 + 1), { status: "allowed" });
  assert.deepEqual(a("a", true, T0 + 15 * MIN), { status: "allowed" });
});

test("15분이 지난 실패는 세지 않음", () => {
  const a = guard();
  for (let i = 0; i < 4; i++) a("a", false, T0);
  assert.deepEqual(a("a", false, T0 + 15 * MIN), { status: "invalid" });
  assert.deepEqual(a("a", true, T0 + 15 * MIN), { status: "allowed" });
});

test("성공은 IP 카운터만 지움", () => {
  const f = (n: number) => ({ failures: Array.from({ length: n }, () => T0), blockedUntil: 0 });
  for (const trustedDevice of [false, true]) {
    const { outcome, next } = applyLoginAttempt({ ip: f(4), global: f(4), trusted: f(4) }, true, T0, trustedDevice);
    assert.deepEqual(outcome, { status: "allowed" });
    assert.equal(next.ip, null);
    assert.equal(next.global?.failures.length, 4);
    assert.equal(next.trusted?.failures.length, 4);
  }
});

test("글로벌 60분 20회 실패 → 새 IP도 60분 정지", () => {
  const a = guard();
  for (let i = 0; i < 20; i++) assert.deepEqual(a(`ip${i}`, false, T0), { status: "invalid" });
  assert.deepEqual(a("fresh", true, T0), blocked("global", 3600));
  assert.deepEqual(a("fresh", true, T0 + 60 * MIN), { status: "allowed" });
});

test("counterExpiresAt = max(마지막 실패 + 창, blockedUntil)", () => {
  assert.equal(counterExpiresAt({ failures: [T0, T0 + MIN], blockedUntil: 0 }, 15 * MIN), T0 + 16 * MIN);
  assert.equal(counterExpiresAt({ failures: [], blockedUntil: T0 + 60 * MIN }, 15 * MIN), T0 + 60 * MIN);
});

test("차단 중 시도는 기록·연장 안 됨, 겹치면 늦은 쪽", () => {
  const a = guard();
  for (let i = 0; i < 5; i++) a("a", false, T0);
  assert.deepEqual(a("a", false, T0 + 5 * MIN), blocked("ip", 600));
  assert.deepEqual(a("a", true, T0 + 5 * MIN), blocked("ip", 600));
  assert.deepEqual(a("a", true, T0 + 15 * MIN), { status: "allowed" });
  assert.deepEqual(
    applyLoginAttempt(
      {
        ip: { failures: [], blockedUntil: T0 + 15 * MIN },
        global: { failures: [], blockedUntil: T0 + 60 * MIN },
        trusted: null,
      },
      true,
      T0,
    ).outcome,
    blocked("global", 3600),
  );
});

test("신뢰 기기는 전역 정지 중에도 로그인, 쿠키 없는 시도는 그대로 정지", () => {
  const a = guard();
  for (let i = 0; i < 20; i++) a(`ip${i}`, false, T0);
  assert.deepEqual(a("fresh", true, T0), blocked("global", 3600));
  assert.deepEqual(a("fresh", true, T0, true), { status: "allowed" });
  assert.deepEqual(a("fresh2", false, T0, true), { status: "invalid" });
});

test("신뢰 기기도 IP 차단은 그대로", () => {
  const a = guard();
  for (let i = 0; i < 5; i++) assert.deepEqual(a("a", false, T0, true), { status: "invalid" });
  assert.deepEqual(a("a", true, T0 + 1, true), blocked("ip", 900));
});

test("신뢰 기기 실패는 전역이 아니라 신뢰 카운터에 기록", () => {
  const { next } = applyLoginAttempt({ ip: null, global: null, trusted: null }, false, T0, true);
  assert.equal(next.global, null);
  assert.deepEqual(next.trusted, { failures: [T0], blockedUntil: 0 });
  assert.deepEqual(next.ip, { failures: [T0], blockedUntil: 0 });
});

test("신뢰 실패 20회면 60분 동안 예외 중단", () => {
  const a = guard();
  for (let i = 0; i < 20; i++) assert.deepEqual(a(`t${i}`, false, T0, true), { status: "invalid" });
  assert.deepEqual(a("plain", true, T0), { status: "allowed" }); // 신뢰 실패로는 전역이 걸리지 않음
  for (let i = 0; i < 20; i++) a(`u${i}`, false, T0);
  assert.deepEqual(a("x", true, T0, true), blocked("global", 3600)); // 예외가 멈춰 전역 정지를 받음
  const later = T0 + 60 * MIN;
  for (let i = 0; i < 20; i++) a(`v${i}`, false, later);
  assert.deepEqual(a("y", true, later), blocked("global", 3600));
  assert.deepEqual(a("y", true, later, true), { status: "allowed" }); // 60분 뒤 예외 재개
});

test("예외가 멈춘 동안 신뢰 기기 실패는 전역에 기록", () => {
  const suspended = { failures: [], blockedUntil: T0 + 60 * MIN };
  const { outcome, next } = applyLoginAttempt({ ip: null, global: null, trusted: suspended }, false, T0, true);
  assert.deepEqual(outcome, { status: "invalid" });
  assert.deepEqual(next.global, { failures: [T0], blockedUntil: 0 });
  assert.deepEqual(next.trusted, suspended);
});
