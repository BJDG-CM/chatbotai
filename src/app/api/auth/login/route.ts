import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getMissingAuthEnv,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  validateCredentials,
} from "@/lib/session";
import { APP_BASE_PATH } from "@/lib/paths";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

export async function POST(request: NextRequest) {
  const missing = getMissingAuthEnv();
  if (missing.length > 0) {
    console.error("Missing authentication environment variables:", missing.join(", "));
    return NextResponse.json(
      { error: "서버 인증 설정이 완료되지 않았습니다." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length > 128 || password.length > 256 || !validateCredentials(username, password)) {
    return NextResponse.json(
      { error: "사용자명 또는 비밀번호가 올바르지 않습니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

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
    path: APP_BASE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
