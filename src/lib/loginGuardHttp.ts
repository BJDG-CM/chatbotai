import type { GuardOutcome } from "./loginGuardPolicy";

const NO_STORE = { "Cache-Control": "no-store" };

/** Cloudflare가 붙여 주는 헤더만 신뢰한다. x-forwarded-for는 클라이언트가 위조할 수 있다. */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/** 가드 결과에 맞는 응답. 통과(allowed)면 null. */
export function loginGuardResponse(outcome: GuardOutcome): Response | null {
  if (outcome.status === "allowed") return null;
  if (outcome.status === "invalid") {
    return Response.json(
      { error: "사용자명 또는 비밀번호가 올바르지 않습니다." },
      { status: 401, headers: NO_STORE },
    );
  }
  return Response.json(
    { error: `로그인 시도가 너무 많습니다. ${Math.ceil(outcome.retryAfterSeconds / 60)}분 후 다시 시도해주세요.` },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(outcome.retryAfterSeconds) } },
  );
}

export function loginGuardUnavailableResponse(): Response {
  return Response.json(
    { error: "로그인 보호 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요." },
    { status: 503, headers: NO_STORE },
  );
}
