import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Conversation } from "@/lib/types";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const JSON_PATH = path.join(DATA_DIR, "history.json");
const MD_PATH = path.join(DATA_DIR, "history.md");
const FILE_BACKUP_ENABLED =
  process.env.ENABLE_FILE_HISTORY_BACKUP === "true" || process.env.NODE_ENV !== "production";

interface HistoryPayload {
  conversations: Conversation[];
  activeId: string | null;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function roleLabel(role: string): string {
  if (role === "user") return "사용자";
  if (role === "assistant") return "어시스턴트";
  return "시스템";
}

function renderMarkdown(payload: HistoryPayload): string {
  const sorted = [...payload.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const lines: string[] = [
    "# 대화 기록",
    "",
    `_마지막 업데이트: ${formatDate(Date.now())} · 총 ${sorted.length}개 대화_`,
    "",
    "> 이 파일은 앱이 자동으로 생성하는 읽기 전용 백업입니다. 실제 앱 데이터(이미지 포함)는",
    "> `data/history.json`에 저장되며, 이 파일은 사람이 읽기 편한 텍스트 로그입니다.",
    "",
  ];

  for (const conv of sorted) {
    lines.push("---", "", `## ${conv.title}`, "", `_모델: ${conv.model} · 마지막 업데이트: ${formatDate(conv.updatedAt)}_`, "");
    for (const msg of conv.messages) {
      const modelSuffix = msg.role === "assistant" && msg.model ? ` (${msg.model})` : "";
      lines.push(`### ${roleLabel(msg.role)}${modelSuffix}`, "");
      if (msg.images && msg.images.length > 0) {
        lines.push(`📎 이미지 ${msg.images.length}개 첨부됨`, "");
      }
      if (msg.error) {
        lines.push(`> ⚠️ 오류: ${msg.error}`, "");
      } else if (msg.content) {
        lines.push(msg.content, "");
      }
    }
  }

  return lines.join("\n");
}

export async function GET() {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  if (!FILE_BACKUP_ENABLED) {
    return Response.json(
      { conversations: [], activeId: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const raw = await fs.readFile(JSON_PATH, "utf-8");
    return new Response(raw, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(JSON.stringify({ conversations: [], activeId: null }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return unauthorizedResponse();

  let body: HistoryPayload;
  try {
    body = await req.json();
  } catch {
    return jsonError("잘못된 요청 본문입니다.", 400);
  }

  if (!Array.isArray(body.conversations)) {
    return jsonError("conversations가 필요합니다.", 400);
  }

  if (!FILE_BACKUP_ENABLED) {
    return Response.json(
      { ok: true, persisted: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await Promise.all([
      fs.writeFile(JSON_PATH, JSON.stringify(body, null, 2), "utf-8"),
      fs.writeFile(MD_PATH, renderMarkdown(body), "utf-8"),
    ]);
  } catch {
    return jsonError("파일 저장에 실패했습니다.", 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
