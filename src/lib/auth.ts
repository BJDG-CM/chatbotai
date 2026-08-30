import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "./session";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "로그인이 필요합니다." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
