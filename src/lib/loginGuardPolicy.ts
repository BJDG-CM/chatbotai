export const LOGIN_GUARD_LIMITS = {
  ipFailures: 5,
  ipWindowMs: 15 * 60_000,
  ipBlockMs: 15 * 60_000,
  globalFailures: 20,
  globalWindowMs: 60 * 60_000,
  globalPauseMs: 60 * 60_000,
  trustedFailures: 20,
  trustedWindowMs: 60 * 60_000,
  trustedPauseMs: 60 * 60_000,
  purgeIntervalMs: 60 * 60_000,
} as const;

export interface FailureCounter {
  failures: number[];
  blockedUntil: number;
}

export interface GuardState {
  ip: FailureCounter | null;
  global: FailureCounter | null;
  /** 신뢰 기기 쿠키를 가진 시도의 실패. 한도를 넘으면 그동안 신뢰 예외를 멈춘다. */
  trusted: FailureCounter | null;
}

export type GuardOutcome =
  | { status: "allowed" }
  | { status: "invalid" }
  | { status: "blocked"; scope: "ip" | "global"; retryAfterSeconds: number };

/** 창 밖의 실패와 만료된 차단을 정리한다. 남은 것이 없으면 null. */
function prune(counter: FailureCounter | null, windowMs: number, now: number): FailureCounter | null {
  if (!counter) return null;
  const failures = counter.failures.filter((t) => now - t < windowMs);
  const blockedUntil = counter.blockedUntil > now ? counter.blockedUntil : 0;
  if (failures.length === 0 && blockedUntil === 0) return null;
  return { failures, blockedUntil };
}

function recordFailure(
  counter: FailureCounter | null,
  now: number,
  limit: number,
  blockMs: number,
): FailureCounter {
  const failures = [...(counter?.failures ?? []), now];
  if (failures.length >= limit) return { failures: [], blockedUntil: now + blockMs };
  return { failures, blockedUntil: 0 };
}

export function applyLoginAttempt(
  state: GuardState,
  credentialsValid: boolean,
  now: number,
  trustedDevice = false,
): { outcome: GuardOutcome; next: GuardState } {
  const ip = prune(state.ip, LOGIN_GUARD_LIMITS.ipWindowMs, now);
  const global = prune(state.global, LOGIN_GUARD_LIMITS.globalWindowMs, now);
  const trusted = prune(state.trusted, LOGIN_GUARD_LIMITS.trustedWindowMs, now);
  // 유효한 신뢰 기기 쿠키는 전역 정지만 건너뛴다. 신뢰 실패 한도를 넘긴 동안은 일반 시도와 같다.
  const exempt = trustedDevice && !((trusted?.blockedUntil ?? 0) > now);

  const ipUntil = ip?.blockedUntil ?? 0;
  const globalUntil = exempt ? 0 : (global?.blockedUntil ?? 0);
  if (ipUntil > now || globalUntil > now) {
    // 차단 중의 시도는 기록하거나 연장하지 않는다. 둘 다 걸리면 늦게 풀리는 쪽.
    const globalLater = globalUntil > ipUntil;
    const until = globalLater ? globalUntil : ipUntil;
    return {
      outcome: {
        status: "blocked",
        scope: globalLater ? "global" : "ip",
        retryAfterSeconds: Math.ceil((until - now) / 1000),
      },
      next: { ip, global, trusted },
    };
  }

  if (credentialsValid) {
    return { outcome: { status: "allowed" }, next: { ip: null, global, trusted } };
  }

  return {
    outcome: { status: "invalid" },
    next: {
      ip: recordFailure(ip, now, LOGIN_GUARD_LIMITS.ipFailures, LOGIN_GUARD_LIMITS.ipBlockMs),
      // 신뢰 시도의 실패는 전역 대신 신뢰 카운터에 쌓는다. 쿠키 없는 제3자는 이 카운터를 건드릴 수 없다.
      global: exempt
        ? global
        : recordFailure(global, now, LOGIN_GUARD_LIMITS.globalFailures, LOGIN_GUARD_LIMITS.globalPauseMs),
      trusted: exempt
        ? recordFailure(trusted, now, LOGIN_GUARD_LIMITS.trustedFailures, LOGIN_GUARD_LIMITS.trustedPauseMs)
        : trusted,
    },
  };
}

export function counterExpiresAt(counter: FailureCounter, windowMs: number): number {
  const lastFailure = counter.failures.length > 0 ? Math.max(...counter.failures) : 0;
  return Math.max(lastFailure + windowMs, counter.blockedUntil);
}
