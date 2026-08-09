import { AUTO_ALL_MODEL_ID, AUTO_FREE_MODEL_ID } from "./defaultModels";
import { MODEL_CATALOG } from "./modelCatalog";
import type { Message, ModelOption } from "./types";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "x-ai": "xAI",
  "meta-llama": "Meta",
  mistralai: "Mistral AI",
  nvidia: "NVIDIA",
  qwen: "Qwen",
  cohere: "Cohere",
  nousresearch: "Nous Research",
  cognitivecomputations: "Cognitive Computations",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  ai21: "AI21",
  allenai: "Allen AI",
  amazon: "Amazon",
  "ibm-granite": "IBM Granite",
  inflection: "Inflection AI",
  liquid: "LiquidAI",
  microsoft: "Microsoft",
  morph: "Morph",
  poolside: "Poolside",
  rekaai: "Reka AI",
  relace: "Relace",
  sakana: "Sakana AI",
  upstage: "Upstage",
  writer: "Writer",
  moonshotai: "Moonshot AI",
  "z-ai": "Z.ai",
};

// ChatGPT / Claude / Google / Grok first, as requested; everything else follows alphabetically.
export const PROVIDER_PRIORITY = ["openai", "anthropic", "google", "x-ai"];

function humanizeProviderKey(key: string): string {
  return key
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getProviderKey(modelId: string): string {
  return modelId.split("/")[0]?.toLowerCase() ?? modelId;
}

export function getProviderLabel(providerKey: string): string {
  return PROVIDER_LABELS[providerKey] ?? humanizeProviderKey(providerKey);
}

// OpenRouter sometimes resolves openrouter/auto (and similar) to a "canonical slug"
// that appends a release date to the base id, e.g. "cohere/north-mini-code-20260617:free"
// for catalog id "cohere/north-mini-code:free". Strip that suffix so lookups still match.
function stripCanonicalDateSuffix(id: string): string {
  return id.replace(/-\d{8}(?=(:.+)?$)/, "");
}

function lookupModelName(id: string, models: ModelOption[]): string | undefined {
  return models.find((m) => m.id === id)?.name ?? MODEL_CATALOG.find((m) => m.id === id)?.name;
}

export function getModelDisplayName(id: string, models: ModelOption[]): string {
  return lookupModelName(id, models) ?? lookupModelName(stripCanonicalDateSuffix(id), models) ?? id;
}

/** Builds the label shown above an assistant message, handling the Auto / Auto(free) prefix. */
export function getMessageModelLabel(message: Message, models: ModelOption[]): string | undefined {
  if (!message.model) return undefined;

  if (message.autoMode === "all") {
    if (!message.model || message.model === AUTO_ALL_MODEL_ID) return "Auto";
    return `Auto → ${getModelDisplayName(message.model, models)}`;
  }

  if (message.autoMode === "free") {
    if (!message.model || message.model === AUTO_FREE_MODEL_ID) return "Auto (free)";
    return `Auto (free) → ${getModelDisplayName(message.model, models)}`;
  }

  return getModelDisplayName(message.model, models);
}
