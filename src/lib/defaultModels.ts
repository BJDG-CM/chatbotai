import type { ModelOption } from "./types";

export const DEFAULT_MODELS: ModelOption[] = [
  { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen3 Next 80B Instruct" },
  { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B" },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano 12B VL" },
  { id: "nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct" },
  { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B Instruct" },
  { id: "nousresearch/hermes-3-llama-3.1-405b:free", name: "Hermes 3 Llama 3.1 405B" },
  { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", name: "Dolphin Mistral 24B (Venice)" },
];

export const DEFAULT_MODEL_ID = DEFAULT_MODELS[0].id;

export const DEFAULT_SYSTEM_PROMPT = "";
export const DEFAULT_TEMPERATURE = 0.7;

// Neither of these is a real OpenRouter model — both are intercepted client-side.
// "Auto": a router model (see autoRouter.ts) picks the best candidate from the
// user's configured model list, then that model is called for the real answer.
export const AUTO_ALL_MODEL_ID = "auto/router";
// "Auto (free)": resolved to the highest-benchmarked untried free model from
// MODEL_CATALOG, retrying with the next-best on failure.
export const AUTO_FREE_MODEL_ID = "auto/free-router";

export const AUTO_MODEL_OPTIONS: ModelOption[] = [
  { id: AUTO_ALL_MODEL_ID, name: "Auto" },
  { id: AUTO_FREE_MODEL_ID, name: "Auto (free)" },
];
