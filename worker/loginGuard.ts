import { DurableObject } from "cloudflare:workers";
import {
  applyLoginAttempt,
  counterExpiresAt,
  LOGIN_GUARD_LIMITS,
  type FailureCounter,
  type GuardOutcome,
} from "../src/lib/loginGuardPolicy";

interface CounterRow {
  failures: string;
  blocked_until: number;
}

const IP_PREFIX = "ip:";
const GLOBAL_KEY = "global";
const TRUSTED_KEY = "trusted";

/**
 * 로그인 시도를 세는 단일 Durable Object(이름 "login").
 * attempt는 읽기부터 쓰기까지 await 없이 동기 SQL만 쓰므로
 * 동시 요청도 한도를 넘지 못한다.
 */
export class LoginGuard extends DurableObject<Cloudflare.Env> {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS login_counters (key TEXT PRIMARY KEY, failures TEXT NOT NULL, blocked_until INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
    );
  }

  /** trustedDevice는 라우트가 서명을 확인한 신뢰 기기 쿠키 여부. 인자가 없는 이전 호출은 비신뢰로 본다. */
  async attempt(ip: string, credentialsValid: boolean, trustedDevice = false): Promise<GuardOutcome> {
    const now = Date.now();
    const ipKey = `${IP_PREFIX}${ip}`;
    const { outcome, next } = applyLoginAttempt(
      { ip: this.read(ipKey), global: this.read(GLOBAL_KEY), trusted: this.read(TRUSTED_KEY) },
      credentialsValid,
      now,
      trustedDevice,
    );
    this.write(ipKey, next.ip, LOGIN_GUARD_LIMITS.ipWindowMs);
    this.write(GLOBAL_KEY, next.global, LOGIN_GUARD_LIMITS.globalWindowMs);
    this.write(TRUSTED_KEY, next.trusted, LOGIN_GUARD_LIMITS.trustedWindowMs);

    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(now + LOGIN_GUARD_LIMITS.purgeIntervalMs);
    }
    return outcome;
  }

  async alarm(): Promise<void> {
    const sql = this.ctx.storage.sql;
    sql.exec("DELETE FROM login_counters WHERE expires_at <= ?", Date.now());
    const remaining = sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM login_counters").one().n;
    if (remaining > 0) {
      await this.ctx.storage.setAlarm(Date.now() + LOGIN_GUARD_LIMITS.purgeIntervalMs);
    }
  }

  private read(key: string): FailureCounter | null {
    const rows = this.ctx.storage.sql
      .exec<CounterRow>("SELECT failures, blocked_until FROM login_counters WHERE key = ?", key)
      .toArray();
    if (rows.length === 0) return null;
    return { failures: JSON.parse(rows[0].failures) as number[], blockedUntil: rows[0].blocked_until };
  }

  private write(key: string, counter: FailureCounter | null, windowMs: number): void {
    const sql = this.ctx.storage.sql;
    if (counter === null) {
      sql.exec("DELETE FROM login_counters WHERE key = ?", key);
      return;
    }
    sql.exec(
      "INSERT OR REPLACE INTO login_counters (key, failures, blocked_until, expires_at) VALUES (?, ?, ?, ?)",
      key,
      JSON.stringify(counter.failures),
      counter.blockedUntil,
      counterExpiresAt(counter, windowMs),
    );
  }
}
