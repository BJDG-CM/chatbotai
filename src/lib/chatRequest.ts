import type { ChatContentPart, ChatMessagePayload } from "./openrouter";
import { MODEL_CATALOG } from "./modelCatalog";
import { AUTO_ALL_MODEL_ID, AUTO_FREE_MODEL_ID, DEFAULT_MODELS } from "./defaultModels";

export const MAX_CHAT_REQUEST_BYTES = 24 * 1024 * 1024;
export const MAX_CHAT_MESSAGES = 200;
export const MAX_IMAGES_PER_MESSAGE = 3;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_OUTPUT_TOKEN_CAP = 16384;

const IMAGE_DATA_URL = /^data:image\/[\w.+-]+;base64,/;
const ROLES = new Set(["system", "user", "assistant"]);
const BAD_MESSAGE = "잘못된 메시지 형식입니다.";

export interface UpstreamChatBody {
  model: string;
  messages: ChatMessagePayload[];
  temperature: number;
  max_tokens: number;
  top_p?: number;
  stream: true;
}

export type ParseChatResult = { ok: true; upstream: UpstreamChatBody } | { ok: false; error: string };

export function allowedModelIds(extraEnv: string | undefined): ReadonlySet<string> {
  const ids = new Set<string>([
    ...MODEL_CATALOG.map((m) => m.id),
    ...DEFAULT_MODELS.map((m) => m.id),
    AUTO_ALL_MODEL_ID,
    AUTO_FREE_MODEL_ID,
  ]);
  for (const id of (extraEnv ?? "").split(",")) {
    const trimmed = id.trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

export function resolveMaxTokens(requested: unknown, capEnv: string | undefined): number {
  const value =
    typeof requested === "number" && Number.isFinite(requested) && requested >= 1
      ? Math.floor(requested)
      : DEFAULT_MAX_TOKENS;
  const envCap = capEnv !== undefined && /^\d+$/.test(capEnv) ? Number(capEnv) : 0;
  const cap = envCap > 0 ? envCap : DEFAULT_OUTPUT_TOKEN_CAP;
  return Math.min(value, cap);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** base64를 디코드하지 않고 디코딩 후 바이트 수를 계산한다. */
function decodedBase64Bytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function parsePart(part: unknown): ChatContentPart | null {
  if (!isRecord(part)) return null;
  if (part.type === "text" && typeof part.text === "string") return { type: "text", text: part.text };
  if (part.type === "image_url" && isRecord(part.image_url)) {
    const url = part.image_url.url;
    if (typeof url === "string" && IMAGE_DATA_URL.test(url)) return { type: "image_url", image_url: { url } };
  }
  return null;
}

type MessageResult = { ok: true; message: ChatMessagePayload } | { ok: false; error: string };

function parseMessage(raw: unknown): MessageResult {
  if (!isRecord(raw) || typeof raw.role !== "string" || !ROLES.has(raw.role)) {
    return { ok: false, error: BAD_MESSAGE };
  }
  if (typeof raw.content === "string") {
    return { ok: true, message: { role: raw.role, content: raw.content } };
  }
  if (!Array.isArray(raw.content)) return { ok: false, error: BAD_MESSAGE };

  const parts: ChatContentPart[] = [];
  for (const rawPart of raw.content) {
    const part = parsePart(rawPart);
    if (!part) return { ok: false, error: BAD_MESSAGE };
    parts.push(part);
  }
  const images = parts.filter((p) => p.type === "image_url");
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    return { ok: false, error: `이미지는 메시지당 최대 ${MAX_IMAGES_PER_MESSAGE}개까지 보낼 수 있습니다.` };
  }
  for (const image of images) {
    if (image.type === "image_url" && decodedBase64Bytes(image.image_url.url) > MAX_IMAGE_BYTES) {
      return { ok: false, error: "이미지는 4MB 이하만 보낼 수 있습니다." };
    }
  }
  return { ok: true, message: { role: raw.role, content: parts } };
}

export function parseChatRequest(
  body: unknown,
  env: { capEnv?: string; extraModelsEnv?: string },
): ParseChatResult {
  if (
    !isRecord(body) ||
    typeof body.model !== "string" ||
    body.model === "" ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return { ok: false, error: "model과 messages가 필요합니다." };
  }
  if (!allowedModelIds(env.extraModelsEnv).has(body.model)) {
    return { ok: false, error: "지원하지 않는 모델입니다." };
  }
  if (body.messages.length > MAX_CHAT_MESSAGES) {
    return { ok: false, error: "대화가 너무 깁니다. 새 대화를 시작해주세요." };
  }

  const messages: ChatMessagePayload[] = [];
  for (const raw of body.messages) {
    const result = parseMessage(raw);
    if (!result.ok) return result;
    messages.push(result.message);
  }

  return {
    ok: true,
    upstream: {
      model: body.model,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
      max_tokens: resolveMaxTokens(body.maxTokens, env.capEnv),
      ...(typeof body.topP === "number" ? { top_p: body.topP } : {}),
      stream: true,
    },
  };
}
