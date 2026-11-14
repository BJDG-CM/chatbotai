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

// IP별 카운터와 글로벌 카운터를 들고 있는 테스트용 저장소
function guard() {
  const ips = new Map<string, FailureCounter | null>();
  let global: FailureCounter | null = null;
  return (ip: string, valid: boolean, now: number) => {
    const { outcome, next } = applyLoginAttempt({ ip: ips.get(ip) ?? null, global }, valid, now);
    ips.set(ip, next.ip);
    global = next.global;
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
  const { outcome, next } = applyLoginAttempt({ ip: f(4), global: f(4) }, true, T0);
  assert.deepEqual(outcome, { status: "allowed" });
  assert.equal(next.ip, null);
  assert.equal(next.global?.failures.length, 4);
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
      },
      true,
      T0,
    ).outcome,
    blocked("global", 3600),
  );
});
