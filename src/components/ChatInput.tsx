"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { fileToDataUrl, MAX_IMAGES_PER_MESSAGE, MAX_IMAGE_BYTES } from "@/lib/utils";
import type { ImageAttachment } from "@/lib/types";

interface ChatInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  images: ImageAttachment[];
  onChangeImages: (images: ImageAttachment[]) => void;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatInput({
  value,
  onChangeValue,
  images,
  onChangeImages,
  isStreaming,
  onSend,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || isStreaming) return;
    onSend(trimmed);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, MAX_IMAGES_PER_MESSAGE - images.length);

    const accepted: ImageAttachment[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        window.alert(`이미지 파일만 첨부할 수 있습니다: ${file.name}`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        window.alert(`${file.name} 파일이 너무 큽니다. 4MB 이하 이미지만 첨부할 수 있습니다.`);
        continue;
      }
      const url = await fileToDataUrl(file);
      accepted.push({ url, name: file.name });
    }

    if (accepted.length > 0) {
      onChangeImages([...images, ...accepted].slice(0, MAX_IMAGES_PER_MESSAGE));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[22px] border border-line bg-input py-2 pl-2 pr-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1.5 pt-1">
          {images.map((img, i) => (
            <div key={img.url + i} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name ?? "첨부 이미지"}
                className="h-16 w-16 rounded-lg border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => onChangeImages(images.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-app opacity-0 group-hover:opacity-100"
                title="제거"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 pl-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES_PER_MESSAGE}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-tertiary hover:bg-chip disabled:cursor-not-allowed disabled:opacity-40"
          title="이미지 첨부"
        >
          <Paperclip size={17} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={1}
          placeholder="무엇이든 물어보세요… (Shift+Enter로 줄바꿈)"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[14.5px] text-primary outline-none placeholder:text-tertiary"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-app hover:opacity-80"
            title="응답 중단"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() && images.length === 0}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-text disabled:cursor-not-allowed disabled:opacity-40"
            title="전송"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
