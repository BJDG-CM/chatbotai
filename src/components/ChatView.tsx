"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { streamChatCompletion, type ChatContentPart, type ChatMessagePayload } from "@/lib/openrouter";
import { SUGGESTIONS } from "@/lib/suggestions";
import { AUTO_ALL_MODEL_ID, AUTO_FREE_MODEL_ID, AUTO_MODEL_OPTIONS } from "@/lib/defaultModels";
import { MODEL_CATALOG } from "@/lib/modelCatalog";
import { getMessageModelLabel } from "@/lib/modelDisplay";
import { chooseModelForRequest, pickCostEffectiveModel } from "@/lib/autoRouter";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ModelSelector from "./ModelSelector";
import { createMessage } from "@/lib/utils";
import type { ImageAttachment, Message } from "@/lib/types";

const MAX_AUTO_FREE_ATTEMPTS = 3;

function toApiContent(message: Message): ChatMessagePayload["content"] {
  if (!message.images || message.images.length === 0) return message.content;
  const parts: ChatContentPart[] = [];
  if (message.content.trim()) parts.push({ type: "text", text: message.content });
  for (const image of message.images) {
    parts.push({ type: "image_url", image_url: { url: image.url } });
  }
  return parts;
}

// Drop failed exchanges (and the user turn that triggered them) before replaying
// history to the API — an errored assistant turn has no real content, and a user
// turn with unsupported attachments would otherwise keep failing every future request.
function buildApiHistory(history: Message[]): Message[] {
  const result: Message[] = [];
  for (const message of history) {
    if (message.role === "assistant" && message.error) {
      if (result[result.length - 1]?.role === "user") result.pop();
      continue;
    }
    result.push(message);
  }
  return result;
}

function isRetryableError(message: string, status?: number): boolean {
  if (status === 404 || status === 408 || status === 409 || status === 429) return true;
  if (status !== undefined && status >= 500) return true;

  return /(?:upstream|overload|temporar(?:y|ily)|unavailable|timeout|timed out|rate.?limit|capacity|no endpoints?|network)/i.test(
    message
  );
}

// Picks the highest-benchmarked untried free model (Artificial Analysis intelligence
// index from OpenRouter's catalog). Unscored models are only used once every scored
// candidate has been tried and failed.
function pickFreeCandidate(needsVision: boolean, exclude: Set<string>): string | null {
  const pool = MODEL_CATALOG.filter((m) => m.free && (!needsVision || m.vision) && !exclude.has(m.id));
  if (pool.length === 0) return null;
  const best = [...pool].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
  return best.id;
}

export default function ChatView() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const createConversation = useChatStore((s) => s.createConversation);
  const setActiveId = useChatStore((s) => s.setActiveId);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const appendMessageImages = useChatStore((s) => s.appendMessageImages);
  const setMessageModel = useChatStore((s) => s.setMessageModel);
  const setMessageError = useChatStore((s) => s.setMessageError);
  const resetMessageForRetry = useChatStore((s) => s.resetMessageForRetry);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const setConversationModel = useChatStore((s) => s.setConversationModel);
  const maybeSetTitleFromFirstMessage = useChatStore((s) => s.maybeSetTitleFromFirstMessage);
  const chatHydrated = useChatStore((s) => s.hasHydrated);

  const models = useSettingsStore((s) => s.models);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const setSelectedModel = useSettingsStore((s) => s.setSelectedModel);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const temperature = useSettingsStore((s) => s.temperature);
  const maxTokens = useSettingsStore((s) => s.maxTokens);
  const topP = useSettingsStore((s) => s.topP);
  const settingsHydrated = useSettingsStore((s) => s.hasHydrated);

  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = conversation?.messages ?? [];
  const lastContent = messages[messages.length - 1]?.content ?? "";
  const selectorModels = [...AUTO_MODEL_OPTIONS, ...models];

  useEffect(() => {
    if (!chatHydrated) return;
    if (conversations.length === 0) {
      createConversation(selectedModel);
    } else if (!activeId) {
      setActiveId(conversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHydrated, conversations.length, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastContent]);

  async function attemptStream(
    conversationId: string,
    assistantId: string,
    model: string,
    payload: ChatMessagePayload[],
    controller: AbortController
  ): Promise<{ ok: true } | { ok: false; message: string; retryable: boolean }> {
    let outcome: { ok: true } | { ok: false; message: string; retryable: boolean } = {
      ok: false,
      message: "알 수 없는 오류가 발생했습니다.",
      retryable: false,
    };
    await streamChatCompletion(
      { model, messages: payload, temperature, maxTokens, topP, signal: controller.signal },
      {
        onDelta: (delta) => appendToMessage(conversationId, assistantId, delta),
        onImages: (images) => appendMessageImages(conversationId, assistantId, images),
        onModel: (resolvedModel) => setMessageModel(conversationId, assistantId, resolvedModel),
        onDone: () => {
          outcome = { ok: true };
        },
        onError: (message, status) => {
          outcome = { ok: false, message, retryable: isRetryableError(message, status) };
        },
      }
    );
    return outcome;
  }

  async function runForModel(
    conversationId: string,
    assistantId: string,
    requestedModel: string,
    history: Message[]
  ) {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    const historyPayload: ChatMessagePayload[] = buildApiHistory(history).map((m) => ({
      role: m.role,
      content: toApiContent(m),
    }));
    const payload = systemPrompt.trim()
      ? [{ role: "system", content: systemPrompt }, ...historyPayload]
      : historyPayload;

    if (requestedModel === AUTO_FREE_MODEL_ID) {
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
      const needsVision = Boolean(lastUserMsg?.images?.length);
      const tried = new Set<string>();
      let lastMessage = "사용 가능한 무료 모델을 찾지 못했습니다.";

      for (let attempt = 0; attempt < MAX_AUTO_FREE_ATTEMPTS; attempt++) {
        if (attempt > 0) resetMessageForRetry(conversationId, assistantId);
        const candidate = pickFreeCandidate(needsVision, tried);
        if (!candidate) break;
        tried.add(candidate);
        setMessageModel(conversationId, assistantId, candidate);

        const result = await attemptStream(conversationId, assistantId, candidate, payload, controller);
        if (result.ok) {
          setIsStreaming(false);
          abortRef.current = null;
          return;
        }
        lastMessage = result.message;
        if (!result.retryable) break;
      }
      setMessageError(conversationId, assistantId, lastMessage);
      setIsStreaming(false);
      abortRef.current = null;
      return;
    }

    if (requestedModel === AUTO_ALL_MODEL_ID) {
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
      const needsVision = Boolean(lastUserMsg?.images?.length);

      const chosen = await chooseModelForRequest(
        models,
        lastUserMsg?.content ?? "",
        needsVision,
        controller.signal
      );

      if (controller.signal.aborted) {
        setIsStreaming(false);
        abortRef.current = null;
        return;
      }

      const finalModel = chosen ?? pickCostEffectiveModel(models) ?? selectedModel;
      setMessageModel(conversationId, assistantId, finalModel);

      const result = await attemptStream(conversationId, assistantId, finalModel, payload, controller);
      if (!result.ok) {
        setMessageError(conversationId, assistantId, result.message);
      }
      setIsStreaming(false);
      abortRef.current = null;
      return;
    }

    const result = await attemptStream(conversationId, assistantId, requestedModel, payload, controller);
    if (!result.ok) {
      setMessageError(conversationId, assistantId, result.message);
    }
    setIsStreaming(false);
    abortRef.current = null;
  }

  function handleSend(text: string) {
    if (!conversation || isStreaming) return;
    if (!text.trim() && pendingImages.length === 0) return;
    const convId = conversation.id;
    const model = conversation.model || selectedModel;

    const userMsg = createMessage("user", text, {
      images: pendingImages.length > 0 ? pendingImages : undefined,
    });
    addMessage(convId, userMsg);
    maybeSetTitleFromFirstMessage(convId, text || "이미지 첨부");
    setInputValue("");
    setPendingImages([]);

    const autoMode = model === AUTO_ALL_MODEL_ID ? "all" : model === AUTO_FREE_MODEL_ID ? "free" : undefined;
    const assistantMsg = createMessage("assistant", "", { model, autoMode });
    addMessage(convId, assistantMsg);
    const assistantId = assistantMsg.id;

    const history = [...conversation.messages, userMsg];
    void runForModel(convId, assistantId, model, history);
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }

  function handleRegenerate() {
    if (!conversation || isStreaming) return;
    const msgs = conversation.messages;
    const lastAssistantOffset = [...msgs].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantOffset === -1) return;
    const idx = msgs.length - 1 - lastAssistantOffset;
    const lastAssistant = msgs[idx];
    const history = msgs.slice(0, idx);
    removeMessage(conversation.id, lastAssistant.id);

    const model = conversation.model || selectedModel;
    const autoMode = model === AUTO_ALL_MODEL_ID ? "all" : model === AUTO_FREE_MODEL_ID ? "free" : undefined;
    const assistantMsg = createMessage("assistant", "", { model, autoMode });
    addMessage(conversation.id, assistantMsg);
    void runForModel(conversation.id, assistantMsg.id, model, history);
  }

  function handleModelChange(id: string) {
    setSelectedModel(id);
    if (conversation) setConversationModel(conversation.id, id);
  }

  if (!chatHydrated || !settingsHydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-tertiary">불러오는 중…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[54px] shrink-0 items-center border-b border-line px-6">
        <ModelSelector
          models={selectorModels}
          value={conversation?.model ?? selectedModel}
          onChange={handleModelChange}
        />
      </header>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10">
          <p className="assistant-prose text-center text-[28px] font-medium leading-[1.3]">
            무엇을 도와드릴까요?
          </p>
          <div className="grid w-full max-w-[560px] grid-cols-2 gap-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInputValue(s)}
                className="rounded-[14px] border border-line px-4 py-3.5 text-left text-[13.5px] leading-[1.4] text-secondary hover:bg-chip"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-4">
          <div className="mx-auto max-w-[660px]">
            {messages.map((message, i) => (
              <MessageBubble
                key={message.id}
                message={message}
                modelName={message.role === "assistant" ? getMessageModelLabel(message, models) : undefined}
                isLast={i === messages.length - 1}
                isStreaming={isStreaming}
                onRegenerate={handleRegenerate}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[660px] shrink-0 px-6 pb-5 pt-3.5">
        <ChatInput
          value={inputValue}
          onChangeValue={setInputValue}
          images={pendingImages}
          onChangeImages={setPendingImages}
          isStreaming={isStreaming}
          onSend={handleSend}
          onStop={handleStop}
        />
        <p className="mt-2 text-center text-xs text-tertiary">
          AI가 생성한 응답은 부정확할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
