import { streamChatCompletion } from "./openrouter";
import { MODEL_CATALOG } from "./modelCatalog";
import type { CatalogModel, ModelOption } from "./types";

// Small, free, and empirically reliable at this short structured-choice task —
// used only to pick a specialist model, never to answer the user directly.
// (gpt-oss-family reasoning models were tried first but sometimes loop
// indecisively between near-tied free candidates and never emit an answer.)
export const AUTO_ROUTER_MODEL_ID = "nvidia/nemotron-nano-9b-v2:free";
// No max_tokens cap here on purpose: many free/small models reason via hidden
// chain-of-thought before answering, and an arbitrary cap can cut that off before
// the actual model id ever appears — better to let it finish than guess a budget.

function catalogInfo(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

function formatPrice(info: CatalogModel | undefined, fallbackFree: boolean): string {
  if (!info) return fallbackFree ? "무료" : "가격 정보 없음";
  if (info.promptPricePerM === 0 && info.completionPricePerM === 0) return "무료";
  return `입력 $${info.promptPricePerM}/1M, 출력 $${info.completionPricePerM}/1M`;
}

function describeCandidate(model: ModelOption): string {
  const info = catalogInfo(model.id);
  const bits = [formatPrice(info, model.id.endsWith(":free"))];
  if (info?.score != null) bits.push(`지능점수 ${info.score}`);
  if (info?.vision) bits.push("비전 지원");
  return `${model.id} — ${model.name} (${bits.join(", ")})`;
}

function costPerformance(id: string): number {
  const info = catalogInfo(id);
  if (!info || info.score == null) return -1;
  const price = info.promptPricePerM + info.completionPricePerM;
  return price <= 0 ? info.score * 1000 : info.score / price;
}

/** Cost-performance fallback (score-per-dollar, free models win by default) if routing fails. */
export function pickCostEffectiveModel(candidates: ModelOption[]): string | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => costPerformance(b.id) - costPerformance(a.id));
  return ranked[0].id;
}

const ROUTING_EXAMPLES = [
  '"안녕" → 무료 모델',
  '"3 더하기 5는?" → 무료 모델 (단순 연산)',
  '"오늘 기분 어때?" / 가벼운 잡담 → 무료 모델',
  '"이 문장 영어로 번역해줘" (짧은 문장) → 무료 모델',
  '"파이썬으로 퀵정렬 구현해줘" → 코딩에 강한 모델 (필요하면 유료도 가능)',
  '"이 500줄 코드에서 메모리 누수 원인을 찾아줘" → 강력한 코딩/추론 모델',
  '"이 수학 증명이 타당한지 단계별로 검증해줘" → 강력한 추론 모델',
].join("\n");

/**
 * Asks AUTO_ROUTER_MODEL_ID to pick the best candidate for the request, then returns
 * that model's id. Returns null if routing fails or its answer can't be matched back
 * to a candidate — callers should fall back to pickCostEffectiveModel in that case.
 */
export async function chooseModelForRequest(
  candidates: ModelOption[],
  userText: string,
  needsVision: boolean,
  signal: AbortSignal
): Promise<string | null> {
  const visionPool = needsVision ? candidates.filter((c) => catalogInfo(c.id)?.vision) : candidates;
  const pool = visionPool.length > 0 ? visionPool : candidates;
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0].id;

  const prompt = [
    "당신은 비용 효율을 최우선으로 고려하는 AI 모델 라우터입니다.",
    "아래 후보 중 사용자 요청을 처리하는 데 실제로 필요한 만큼만 성능을 쓰는 모델 하나를 고르세요.",
    "",
    "판단 원칙:",
    "1. 기본값은 항상 무료이거나 가장 저렴한 모델입니다. 인사, 잡담, 짧은 질문, 간단한 사실 확인, 기본 산수, 짧은 번역/요약에는 반드시 무료 모델을 고르세요.",
    "2. 더 비싸거나 큰 모델은 다음에만 고려하세요: 복잡한 코드 작성/디버깅, 여러 단계의 수학·논리 추론, 매우 긴 문서 분석, 전문 지식이 필요한 질의, 정교한 창작.",
    "3. 가격 차이가 크면(예: 10배 이상) 지능 점수가 조금 더 높다는 이유만으로 비싼 모델을 고르지 마세요. 무료/저가 모델로 충분히 처리 가능한지 먼저 생각하세요.",
    "",
    "판단 예시:",
    ROUTING_EXAMPLES,
    "",
    "후보 목록:",
    pool.map(describeCandidate).join("\n"),
    "",
    `사용자 요청: "${userText.slice(0, 800)}"`,
    "",
    "다른 설명 없이, 후보 목록에 있는 모델 ID를 정확히 그대로 한 줄만 출력하세요.",
  ].join("\n");

  let text = "";
  try {
    await streamChatCompletion(
      {
        model: AUTO_ROUTER_MODEL_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        signal,
      },
      {
        onDelta: (delta) => {
          text += delta;
        },
        onImages: () => {},
        onDone: () => {},
        onError: () => {},
      }
    );
  } catch {
    return null;
  }

  return matchCandidateId(text, pool);
}

// Models sometimes answer with the id verbatim, sometimes drop the ":free" suffix,
// and occasionally wrap it in a short sentence — try progressively looser matches.
function matchCandidateId(rawText: string, pool: ModelOption[]): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;
  return (
    pool.find((c) => c.id === trimmed)?.id ??
    pool.find((c) => c.id.startsWith(trimmed) || trimmed.startsWith(c.id))?.id ??
    pool.find((c) => trimmed.includes(c.id))?.id ??
    null
  );
}
