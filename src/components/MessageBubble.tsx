"use client";

import { useState } from "react";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import Markdown from "./Markdown";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  modelName?: string;
  isLast: boolean;
  isStreaming: boolean;
  onRegenerate: () => void;
}

export default function MessageBubble({
  message,
  modelName,
  isLast,
  isStreaming,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const hasImages = Boolean(message.images && message.images.length > 0);
  const showRegenerate =
    !isUser && isLast && !isStreaming && !message.error && (message.content.length > 0 || hasImages);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5 px-6 py-2.5">
        {hasImages && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {message.images!.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.url + i}
                src={img.url}
                alt={img.name ?? "첨부 이미지"}
                className="h-28 w-28 rounded-xl border border-line object-cover"
              />
            ))}
          </div>
        )}
        {message.content && (
          <div className="msg-text bubble-user max-w-[75%] rounded-[16px_16px_4px_16px] px-4 py-[11px] leading-[1.55] whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-6 py-2.5">
      <div className="mt-0.5 h-[26px] w-[26px] shrink-0 rounded-[8px] bg-accent" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {modelName && <span className="text-[11px] font-medium text-tertiary">{modelName}</span>}

        {message.error ? (
          <p className="text-sm text-red-500">{message.error}</p>
        ) : message.content || hasImages ? (
          <>
            {message.content && (
              <div className="assistant-prose">
                <Markdown content={message.content} />
              </div>
            )}
            {hasImages && (
              <div className="flex flex-wrap gap-2">
                {message.images!.map((img, i) => (
                  <div key={img.url + i} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name ?? "생성된 이미지"}
                      className="max-h-[320px] max-w-full rounded-xl border border-line object-contain"
                    />
                    <a
                      href={img.url}
                      download={img.name ?? "image.png"}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-app opacity-0 group-hover:opacity-100"
                      title="다운로드"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="flex gap-1 py-1.5">
            <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_infinite] rounded-full bg-tertiary" />
            <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_infinite_0.15s] rounded-full bg-tertiary" />
            <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_infinite_0.3s] rounded-full bg-tertiary" />
          </span>
        )}

        {!message.error && (message.content || hasImages) && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded p-1 text-tertiary hover:opacity-70"
              title="복사"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {showRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className={cn("flex items-center gap-1 rounded p-1 text-tertiary hover:opacity-70")}
                title="다시 생성"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
