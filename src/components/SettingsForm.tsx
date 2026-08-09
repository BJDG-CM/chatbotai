"use client";

import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useSettingsStore, type FontSize } from "@/lib/settingsStore";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import Switch from "./Switch";
import ModelCatalogPicker from "./ModelCatalogPicker";
import type { CatalogModel } from "@/lib/types";

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
];

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      {description && <p className="mt-1 text-xs text-secondary">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function SettingsForm() {
  const models = useSettingsStore((s) => s.models);
  const addModel = useSettingsStore((s) => s.addModel);
  const updateModel = useSettingsStore((s) => s.updateModel);
  const removeModel = useSettingsStore((s) => s.removeModel);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);
  const setSystemPrompt = useSettingsStore((s) => s.setSystemPrompt);
  const temperature = useSettingsStore((s) => s.temperature);
  const setTemperature = useSettingsStore((s) => s.setTemperature);
  const maxTokens = useSettingsStore((s) => s.maxTokens);
  const setMaxTokens = useSettingsStore((s) => s.setMaxTokens);
  const topP = useSettingsStore((s) => s.topP);
  const setTopP = useSettingsStore((s) => s.setTopP);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const saveHistory = useSettingsStore((s) => s.saveHistory);
  const setSaveHistory = useSettingsStore((s) => s.setSaveHistory);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);

  const clearAllConversations = useChatStore((s) => s.clearAllConversations);
  const conversationCount = useChatStore((s) => s.conversations.length);

  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [addMode, setAddMode] = useState<"catalog" | "manual">("catalog");
  const [topPEnabled, setTopPEnabled] = useState(topP !== null);
  const [maxTokensEnabled, setMaxTokensEnabled] = useState(maxTokens !== null);

  if (!hasHydrated) {
    return <div className="p-8 text-sm text-tertiary">불러오는 중…</div>;
  }

  function handleAddModel() {
    const id = newId.trim();
    if (!id) return;
    addModel({ id, name: newName.trim() || id });
    setNewId("");
    setNewName("");
  }

  function handleAddFromCatalog(model: CatalogModel) {
    addModel({ id: model.id, name: model.name });
  }

  function handleClearAll() {
    if (conversationCount === 0) return;
    if (window.confirm(`대화 ${conversationCount}개를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
      clearAllConversations();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold text-primary">설정</h1>
      <p className="mt-1 text-sm text-secondary">
        모든 설정은 서버로 전송되지 않고 브라우저의 localStorage에만 저장됩니다.
      </p>

      <SectionCard title="모델 관리">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs text-secondary hover:bg-chip"
            title="모델 목록, 프롬프트, 생성 옵션을 기본값으로 되돌립니다"
          >
            <RotateCcw size={13} />
            기본값 복원
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {models.map((model) => (
            <div key={model.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <div className="flex flex-1 flex-col gap-1">
                <input
                  value={model.name}
                  onChange={(e) => updateModel(model.id, { name: e.target.value })}
                  placeholder="표시 이름"
                  className="rounded-md border border-line bg-transparent px-2 py-1 text-sm text-primary outline-none focus:border-accent"
                />
                <input
                  value={model.id}
                  onChange={(e) => updateModel(model.id, { id: e.target.value })}
                  placeholder="모델 ID"
                  className="rounded-md border border-line bg-transparent px-2 py-1 font-mono text-xs text-secondary outline-none focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={() => removeModel(model.id)}
                className="rounded-md p-2 text-tertiary hover:bg-red-500/10 hover:text-red-500"
                title="삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-1 border-b border-line">
          <button
            type="button"
            onClick={() => setAddMode("catalog")}
            className={cn(
              "border-b-2 px-1 pb-2 text-xs font-medium",
              addMode === "catalog"
                ? "border-accent text-primary"
                : "border-transparent text-tertiary hover:text-secondary"
            )}
          >
            카탈로그에서 추가
          </button>
          <button
            type="button"
            onClick={() => setAddMode("manual")}
            className={cn(
              "border-b-2 px-1 pb-2 text-xs font-medium",
              addMode === "manual"
                ? "border-accent text-primary"
                : "border-transparent text-tertiary hover:text-secondary"
            )}
          >
            직접 입력
          </button>
        </div>

        {addMode === "catalog" ? (
          <div className="mt-3">
            <ModelCatalogPicker
              addedIds={new Set(models.map((m) => m.id))}
              onAdd={handleAddFromCatalog}
            />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-line p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="표시 이름"
              className="flex-1 rounded-md border border-line bg-transparent px-2 py-1.5 text-sm text-primary outline-none focus:border-accent"
            />
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="모델 ID (예: vendor/model:free)"
              className="flex-1 rounded-md border border-line bg-transparent px-2 py-1.5 font-mono text-xs text-primary outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={handleAddModel}
              disabled={!newId.trim()}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-text disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus size={13} />
              추가
            </button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="시스템 프롬프트" description="모든 대화에 공통으로 적용되는 지침입니다.">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="예: 당신은 친절하고 간결하게 답변하는 어시스턴트입니다."
          className="w-full resize-none rounded-lg border border-line bg-transparent px-3 py-2 text-sm text-primary outline-none focus:border-accent"
        />
      </SectionCard>

      <SectionCard title="생성 옵션">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary">Temperature</span>
              <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-mono text-secondary">
                {temperature.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              값이 높을수록 응답이 다양해지고, 낮을수록 일관성이 높아집니다.
            </p>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--accent)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={topPEnabled}
                  onChange={(e) => {
                    setTopPEnabled(e.target.checked);
                    setTopP(e.target.checked ? 1 : null);
                  }}
                  className="accent-[var(--accent)]"
                />
                Top P 사용
              </label>
              {topPEnabled && (
                <span className="rounded-md bg-chip px-2 py-0.5 text-xs font-mono text-secondary">
                  {(topP ?? 1).toFixed(2)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-secondary">
              토큰 후보를 확률 상위 몇 %까지만 고려할지 정합니다. 끄면 모델 기본값을 사용합니다.
            </p>
            {topPEnabled && (
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={topP ?? 1}
                onChange={(e) => setTopP(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--accent)]"
              />
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={maxTokensEnabled}
                onChange={(e) => {
                  setMaxTokensEnabled(e.target.checked);
                  setMaxTokens(e.target.checked ? 1024 : null);
                }}
                className="accent-[var(--accent)]"
              />
              최대 응답 길이 제한
            </label>
            <p className="mt-1 text-xs text-secondary">
              응답이 생성할 수 있는 최대 토큰 수입니다. 끄면 모델 기본값을 사용합니다.
            </p>
            {maxTokensEnabled && (
              <input
                type="number"
                min={1}
                max={32000}
                step={1}
                value={maxTokens ?? 1024}
                onChange={(e) => setMaxTokens(Math.max(1, Number(e.target.value) || 1))}
                className="mt-3 w-32 rounded-md border border-line bg-transparent px-2 py-1.5 text-sm text-primary outline-none focus:border-accent"
              />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="화면">
        <div className="flex flex-col gap-5">
          <div>
            <span className="text-sm text-primary">글꼴 크기</span>
            <p className="mt-1 text-xs text-secondary">채팅 메시지의 글자 크기를 조절합니다.</p>
            <div className="mt-2 inline-flex rounded-lg border border-line p-1">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFontSize(opt.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    fontSize === opt.value ? "bg-accent text-accent-text" : "text-secondary hover:bg-chip"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="데이터 및 개인정보">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm text-primary">대화 기록 저장</span>
              <p className="mt-1 text-xs text-secondary">
                localStorage와 <code className="rounded bg-chip px-1 py-0.5 font-mono">data/history.json</code>·
                <code className="rounded bg-chip px-1 py-0.5 font-mono">data/history.md</code> 파일에 함께
                저장됩니다. 끄면 새로고침하거나 앱을 닫을 때 대화 내용이 저장되지 않습니다(임시 대화 모드).
              </p>
            </div>
            <Switch checked={saveHistory} onChange={setSaveHistory} label="대화 기록 저장" />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-line p-3">
            <div>
              <span className="text-sm text-primary">모든 대화 삭제</span>
              <p className="mt-1 text-xs text-secondary">
                저장된 대화 {conversationCount}개를 모두 삭제합니다. 되돌릴 수 없습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={conversationCount === 0}
              className="flex shrink-0 items-center gap-1 rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 size={13} />
              전체 삭제
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
