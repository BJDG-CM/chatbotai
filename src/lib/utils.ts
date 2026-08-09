import { nanoid } from "nanoid";
import type { Message, Role } from "./types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function createMessage(
  role: Role,
  content: string,
  extra?: Partial<Pick<Message, "model" | "error" | "images" | "autoMode">>
): Message {
  return { id: nanoid(), role, content, createdAt: Date.now(), ...extra };
}

export function truncateTitle(text: string, max = 40): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed || "새 대화";
  return trimmed.slice(0, max).trimEnd() + "…";
}

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function getBrowserStorage(): Storage {
  if (typeof window === "undefined") {
    return noopStorage as unknown as Storage;
  }
  return window.localStorage;
}

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGES_PER_MESSAGE = 3;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
