export type Role = "system" | "user" | "assistant";

export interface ImageAttachment {
  url: string;
  name?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  images?: ImageAttachment[];
  createdAt: number;
  model?: string;
  /** Set when this message was answered via the Auto / Auto(free) router; `model` holds the resolved model. */
  autoMode?: "all" | "free";
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  free: boolean;
  vision: boolean;
  context: number;
  /** Artificial Analysis "intelligence index" benchmark score, when OpenRouter reports one. */
  score: number | null;
  /** USD per 1M tokens. */
  promptPricePerM: number;
  completionPricePerM: number;
}
