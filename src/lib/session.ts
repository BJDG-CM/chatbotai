import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "chatbotai_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function validateCredentials(username: string, password: string): boolean {
  const expectedUsername = getRequiredEnv("CHATBOT_USERNAME");
  const expectedPassword = getRequiredEnv("CHATBOT_PASSWORD");
  if (!expectedUsername || !expectedPassword || !hasStrongSessionSecret()) return false;
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createSessionToken(username: string, now = Date.now()): string {
  const secret = getRequiredEnv("CHATBOT_SESSION_SECRET");
  if (!hasStrongSessionSecret()) {
    throw new Error("CHATBOT_SESSION_SECRET must contain at least 32 bytes");
  }

  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: username,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const secret = getRequiredEnv("CHATBOT_SESSION_SECRET");
  const expectedUsername = getRequiredEnv("CHATBOT_USERNAME");
  if (!hasStrongSessionSecret() || !expectedUsername) return false;

  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) return false;
  const expectedSignature = signature(encoded, secret);
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
