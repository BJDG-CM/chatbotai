import { NextRequest } from "next/server";
import { MAX_CHAT_REQUEST_BYTES, parseChatRequest } from "@/lib/chatRequest";
import { readJsonBody } from "@/lib/readBody";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { checkMutationRequest } from "@/lib/requestGuards";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const rejected = checkMutationRequest(req, { json: true });
  if (rejected) return rejected;

  if (!(await isAuthenticated())) return unauthorizedResponse();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(
      "OPENROUTER_API_KEY가 설정되지 않았습니다. .env 파일에 API 키를 입력해주세요.",
      500
    );
  }

  const read = await readJsonBody(req, MAX_CHAT_REQUEST_BYTES);
  if (!read.ok) {
    return read.status === 413
      ? jsonError("요청 크기가 너무 큽니다. 첨부 이미지 용량을 줄여주세요.", 413)
      : jsonError("잘못된 요청 본문입니다.", 400);
  }

  const result = parseChatRequest(read.value, {
    capEnv: process.env.CHAT_MAX_OUTPUT_TOKENS,
    extraModelsEnv: process.env.CHAT_EXTRA_MODEL_IDS,
  });
  if (!result.ok) return jsonError(result.error, 400);

  const siteUrl = process.env.SITE_URL || "https://chatbot.yejunlee.com";
  const siteName = process.env.SITE_NAME || "Yejun's Private Chat";

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": siteUrl,
        "X-Title": siteName,
      },
      body: JSON.stringify(result.upstream),
      signal: req.signal,
    });
  } catch {
    return jsonError("OpenRouter에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.", 502);
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      const raw = (await upstream.json()) as { error?: string | { message?: string } };
      if (raw?.error) {
        detail = typeof raw.error === "string" ? raw.error : raw.error.message || "";
      }
    } catch {
      // ignore body parse failure
    }

    let message = detail || `요청이 실패했습니다. (status ${upstream.status})`;
    if (upstream.status === 429) {
      message =
        "무료 모델의 요청 한도(rate limit)를 초과했습니다. 잠시 후 다시 시도하거나 다른 모델을 선택해주세요." +
        (detail ? ` (OpenRouter 응답: ${detail})` : "");
    } else if (upstream.status === 401) {
      message = "API 키가 유효하지 않습니다. .env의 OPENROUTER_API_KEY를 확인해주세요.";
    }
    return jsonError(message, upstream.status || 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
