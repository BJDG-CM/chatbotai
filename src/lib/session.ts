import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "chatbotai_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const TRUSTED_DEVICE_COOKIE_NAME = "chatbotai_trusted_device";
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
// 서명 대상 앞에 용도를 붙여, 같은 비밀값으로 서명한 세션 토큰과 서로 바꿔 쓸 수 없게 한다.
const TRUSTED_DEVICE_PURPOSE = "trusted-device";

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function getRequiredEnv(name: "CHATBOT_USERNAME" | "CHATBOT_PASSWORD" | "CHATBOT_SESSION_SECRET") {
  return process.env[name] ?? "";
}

function hasStrongSessionSecret(): boolean {
  return Buffer.byteLength(getRequiredEnv("CHATBOT_SESSION_SECRET"), "utf8") >= 32;
}

export function getMissingAuthEnv(): string[] {
  return (["CHATBOT_USERNAME", "CHATBOT_PASSWORD", "CHATBOT_SESSION_SECRET"] as const).filter(
    (name) => !getRequiredEnv(name) || (name === "CHATBOT_SESSION_SECRET" && !hasStrongSessionSecret())
  );
}

function digest(value: string): Buffer {
  return createHmac("sha256", "chatbotai-credential-check").update(value).digest();
}

function safeEqual(left: string, right: string): boolean {
  return timingSafeEqual(digest(left), digest(right));
}

function signature(payload: string, secret: string, purpose?: string): string {
  return createHmac("sha256", secret)
    .update(purpose ? `${purpose}.${payload}` : payload)
    .digest("base64url");
}

export function validateCredentials(username: string, password: string): boolean {
  const expectedUsername = getRequiredEnv("CHATBOT_USERNAME");
  const expectedPassword = getRequiredEnv("CHATBOT_PASSWORD");
  if (!expectedUsername || !expectedPassword || !hasStrongSessionSecret()) return false;
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

function issueToken(username: string, now: number, maxAgeSeconds: number, purpose?: string): string {
  const secret = getRequiredEnv("CHATBOT_SESSION_SECRET");
  if (!hasStrongSessionSecret()) {
    throw new Error("CHATBOT_SESSION_SECRET must contain at least 32 bytes");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: username,
    iat: issuedAt,
    exp: issuedAt + maxAgeSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret, purpose)}`;
}

export function createSessionToken(username: string, now = Date.now()): string {
  return issueToken(username, now, SESSION_MAX_AGE_SECONDS);
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  return verifyToken(token, now);
}

export function createTrustedDeviceToken(username: string, now = Date.now()): string {
  return issueToken(username, now, TRUSTED_DEVICE_MAX_AGE_SECONDS, TRUSTED_DEVICE_PURPOSE);
}

export function verifyTrustedDeviceToken(token: string | undefined, now = Date.now()): boolean {
  return verifyToken(token, now, TRUSTED_DEVICE_PURPOSE);
}

function verifyToken(token: string | undefined, now: number, purpose?: string): boolean {
  if (!token) return false;
  const secret = getRequiredEnv("CHATBOT_SESSION_SECRET");
  const expectedUsername = getRequiredEnv("CHATBOT_USERNAME");
  if (!hasStrongSessionSecret() || !expectedUsername) return false;

  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) return false;
  const expectedSignature = signature(encoded, secret, purpose);
  if (!safeEqual(providedSignature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    const currentTime = Math.floor(now / 1000);
    return (
      payload.sub === expectedUsername &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      payload.iat <= currentTime + 60 &&
      payload.exp > currentTime
    );
  } catch {
    return false;
  }
}
