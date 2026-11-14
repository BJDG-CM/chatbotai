import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getMissingAuthEnv,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateCredentials,
} from "@/lib/session";
import { checkMutationRequest } from "@/lib/requestGuards";
import { readJsonBody } from "@/lib/readBody";
import {
  clientIp,
  loginGuardResponse,
  loginGuardUnavailableResponse,
} from "@/lib/loginGuardHttp";
import type { GuardOutcome } from "@/lib/loginGuardPolicy";

const LOGIN_MAX_BODY_BYTES = 4096;

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

export async function POST(request: NextRequest) {
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

  // 확인과 기록은 LoginGuard 호출 한 번 안에서 원자적으로 일어난다. 실패하면 닫힌 채로 둔다.
  let outcome: GuardOutcome;
  try {
    const guard = env.LOGIN_GUARD;
    outcome = await guard.get(guard.idFromName("login")).attempt(clientIp(request), valid);
  } catch {
    return loginGuardUnavailableResponse();
  }
  const guarded = loginGuardResponse(outcome);
  if (guarded) return guarded;

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(username),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
