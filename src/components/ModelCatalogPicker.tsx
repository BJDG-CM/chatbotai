"use client";

import { useMemo, useState } from "react";
import { Eye, Plus, Sparkles } from "lucide-react";
import { MODEL_CATALOG } from "@/lib/modelCatalog";
import { cn } from "@/lib/utils";
import type { CatalogModel } from "@/lib/types";

interface ModelCatalogPickerProps {
  addedIds: Set<string>;
  onAdd: (model: CatalogModel) => void;
}

function byQuality(a: CatalogModel, b: CatalogModel): number {
  return (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name);
}

export default function ModelCatalogPicker({ addedIds, onAdd }: ModelCatalogPickerProps) {
  const [query, setQuery] = useState("");

  const { free, paid } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (m: CatalogModel) =>
      !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    const free = MODEL_CATALOG.filter((m) => m.free && matches(m)).sort(byQuality);
    const paid = MODEL_CATALOG.filter((m) => !m.free && matches(m)).sort(byQuality);
    return { free, paid };
  }, [query]);

  function renderRow(model: CatalogModel) {
    const added = addedIds.has(model.id);
    return (
      <div
        key={model.id}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-chip"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-primary">{model.name}</span>
            {model.vision && <Eye size={12} className="shrink-0 text-tertiary" />}
            {model.score !== null && (
              <span
                className="flex shrink-0 items-center gap-0.5 rounded bg-accent-soft px-1.5 py-[1px] text-[10px] font-medium text-accent"
                title="Artificial Analysis 지능 지수"
              >
                <Sparkles size={9} />
                {model.score.toFixed(1)}
              </span>
            )}
          </div>
          <span className="truncate text-[11.5px] text-tertiary">{model.id}</span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(model)}
          disabled={added}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
            added
              ? "cursor-default text-tertiary"
              : "bg-accent text-accent-text hover:opacity-80"
          )}
        >
          {added ? "추가됨" : <Plus size={13} />}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="모델 이름 또는 ID 검색…"
        className="w-full border-b border-line bg-transparent px-3 py-2 text-sm text-primary outline-none placeholder:text-tertiary"
      />
      <div className="max-h-72 overflow-y-auto p-1.5">
        {free.length === 0 && paid.length === 0 && (
          <div className="px-2.5 py-4 text-center text-xs text-tertiary">검색 결과가 없습니다.</div>
        )}
        {free.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary">
              무료 ({free.length})
            </div>
            {free.map(renderRow)}
          </div>
        )}
        {paid.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary">
              유료 ({paid.length})
            </div>
            {paid.map(renderRow)}
          </div>
        )}
      </div>
    </div>
  );
}
