import { env } from "cloudflare:workers";
import type { NextRequest } from "next/server";
import { handleLogin } from "@/lib/loginHandler";

export async function POST(request: NextRequest) {
  return handleLogin(request, (ip, credentialsValid, trustedDevice) => {
    const guard = env.LOGIN_GUARD;
    return guard.get(guard.idFromName("login")).attempt(ip, credentialsValid, trustedDevice);
  });
}
