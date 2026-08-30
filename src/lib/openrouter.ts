import type { ImageAttachment } from "./types";
import { appPath } from "./paths";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessagePayload {
  role: string;
  content: string | ChatContentPart[];
}

export interface StreamChatOptions {
  model: string;
  messages: ChatMessagePayload[];
  temperature: number;
  maxTokens?: number | null;
  topP?: number | null;
  signal: AbortSignal;
}

export interface StreamChatCallbacks {
  onDelta: (text: string) => void;
  onImages: (images: ImageAttachment[]) => void;
  /** Fired once, the first time the resolved `model` field is seen (relevant for openrouter/auto). */
  onModel?: (model: string) => void;
  onDone: () => void;
  onError: (message: string, status?: number) => void;
}

interface OpenRouterImagePart {
  type?: string;
  image_url?: { url?: string };
}

interface OpenRouterStreamChunk {
  model?: string;
  error?: { message?: string } | string;
  choices?: { delta?: { content?: string; images?: OpenRouterImagePart[] } }[];
}

function extractImages(parts: OpenRouterImagePart[] | undefined): ImageAttachment[] {
  if (!Array.isArray(parts)) return [];
  return parts
    .map((part) => part.image_url?.url)
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url }));
}

export async function streamChatCompletion(
  { model, messages, temperature, maxTokens, topP, signal }: StreamChatOptions,
  { onDelta, onImages, onModel, onDone, onError }: StreamChatCallbacks
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(appPath("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        maxTokens: maxTokens ?? undefined,
        topP: topP ?? undefined,
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      onDone();
      return;
    }
    onError("서버에 연결할 수 없습니다.");
    return;
  }

  if (!response.ok || !response.body) {
    let message = `요청이 실패했습니다. (status ${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    onError(message, response.status);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let modelReported = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const rawLine of event.split("\n")) {
          const line = rawLine.trim();
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data) as OpenRouterStreamChunk;
            if (parsed.error) {
              const message =
                typeof parsed.error === "string"
                  ? parsed.error
                  : parsed.error.message || "알 수 없는 오류가 발생했습니다.";
              onError(message);
              return;
            }
            if (!modelReported && parsed.model) {
              modelReported = true;
              onModel?.(parsed.model);
            }
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) onDelta(delta.content);
            const images = extractImages(delta?.images);
            if (images.length > 0) onImages(images);
          } catch {
            // partial/non-JSON chunk, skip
          }
        }
      }
    }
    onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      onDone();
      return;
    }
    onError("스트리밍 중 오류가 발생했습니다.");
  }
}
