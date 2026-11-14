import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  createTrustedDeviceToken,
  getMissingAuthEnv,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  TRUSTED_DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
  validateCredentials,
  verifyTrustedDeviceToken,
} from "./session";
import { checkMutationRequest } from "./requestGuards";
import { readJsonBody } from "./readBody";
import { clientIp, loginGuardResponse, loginGuardUnavailableResponse } from "./loginGuardHttp";
import type { GuardOutcome } from "./loginGuardPolicy";
import { appPath } from "./paths";

const LOGIN_MAX_BODY_BYTES = 4096;

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

/** 시도를 LoginGuard에 기록하고 판정을 받는다. 라우트가 Durable Object를 연결해 넘긴다. */
export type LoginAttempt = (
  ip: string,
  credentialsValid: boolean,
  trustedDevice: boolean,
) => Promise<GuardOutcome>;

export async function handleLogin(request: NextRequest, attempt: LoginAttempt): Promise<Response> {
  const rejected = checkMutationRequest(request, { json: true });
  if (rejected) return rejected;

  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    console.error("Missing authentication environment variables:", missing.join(", "));
    return NextResponse.json(
      { error: "서버 인증 설정이 완료되지 않았습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const read = await readJsonBody(request, LOGIN_MAX_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { error: read.status === 413 ? "요청 크기가 너무 큽니다." : "잘못된 요청입니다." },
      { status: read.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  const body = (read.value !== null && typeof read.value === "object" ? read.value : {}) as LoginBody;

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const valid = username.length <= 128 && password.length <= 256 && validateCredentials(username, password);
  // 위조·만료된 쿠키나 세션 토큰은 쿠키가 없는 것과 같다. 유효하면 전역 정지만 건너뛴다.
  const trustedDevice = verifyTrustedDeviceToken(request.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value);

  // 확인과 기록은 LoginGuard 호출 한 번 안에서 원자적으로 일어난다. 실패하면 닫힌 채로 둔다.
  let outcome: GuardOutcome;
  try {
    outcome = await attempt(clientIp(request), valid, trustedDevice);
  } catch (error) {
    console.error(
      "LoginGuard unavailable:",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown"
    );
    return loginGuardUnavailableResponse();
  }
  const guarded = loginGuardResponse(outcome);
  if (guarded) return guarded;

  const secure = process.env.NODE_ENV === "production";
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(username),
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  // 로그인할 때마다 새로 발급하므로 90일 안에 한 번이라도 로그인한 기기는 계속 신뢰된다.
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE_NAME,
    value: createTrustedDeviceToken(username),
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: appPath("/api/auth/login"),
    maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
  });
  return response;
}
