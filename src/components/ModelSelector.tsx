"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTO_ALL_MODEL_ID, AUTO_FREE_MODEL_ID } from "@/lib/defaultModels";
import { getProviderKey, getProviderLabel, PROVIDER_PRIORITY } from "@/lib/modelDisplay";
import type { ModelOption } from "@/lib/types";

interface ModelSelectorProps {
  models: ModelOption[];
  value: string;
  onChange: (id: string) => void;
}

interface ProviderGroup {
  key: string;
  label: string;
  models: ModelOption[];
}

const FLYOUT_CLOSE_DELAY_MS = 200;

function isAutoId(id: string): boolean {
  return id === AUTO_ALL_MODEL_ID || id === AUTO_FREE_MODEL_ID;
}

function groupByProvider(list: ModelOption[]): ProviderGroup[] {
  const map = new Map<string, ModelOption[]>();
  for (const model of list) {
    const key = getProviderKey(model.id);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(model);
  }
  const groups = [...map.entries()].map(([key, models]) => ({
    key,
    label: getProviderLabel(key),
    models,
  }));
  groups.sort((a, b) => {
    const ai = PROVIDER_PRIORITY.indexOf(a.key);
    const bi = PROVIDER_PRIORITY.indexOf(b.key);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.label.localeCompare(b.label);
  });
  return groups;
}

export default function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [openProviderKey, setOpenProviderKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeMenu() {
    setOpen(false);
    setOpenProviderKey(null);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = models.find((m) => m.id === value) ?? models[0];

  const { autoModels, paidGroups, freeGroups } = useMemo(() => {
    const autoModels: ModelOption[] = [];
    const rest: ModelOption[] = [];
    for (const model of models) {
      if (isAutoId(model.id)) autoModels.push(model);
      else rest.push(model);
    }
    const paid = rest.filter((m) => !m.id.endsWith(":free"));
    const free = rest.filter((m) => m.id.endsWith(":free"));
    return { autoModels, paidGroups: groupByProvider(paid), freeGroups: groupByProvider(free) };
  }, [models]);

  function openFlyout(key: string) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenProviderKey(key);
  }

  function scheduleCloseFlyout() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenProviderKey(null), FLYOUT_CLOSE_DELAY_MS);
  }

  function toggleMenu() {
    if (open) closeMenu();
    else setOpen(true);
  }

  function selectModel(id: string) {
    onChange(id);
    closeMenu();
  }

  function renderAutoItem(model: ModelOption) {
    return (
      <button
        key={model.id}
        type="button"
        onClick={() => selectModel(model.id)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-primary hover:bg-chip",
          model.id === value && "bg-chip"
        )}
      >
        <Sparkles size={12} className="text-accent" />
        {model.name}
      </button>
    );
  }

  function renderProviderGroup(group: ProviderGroup) {
    const isActive = group.models.some((m) => m.id === value);
    const isOpen = openProviderKey === group.key;
    return (
      <div
        key={group.key}
        className="relative"
        onMouseEnter={() => openFlyout(group.key)}
        onMouseLeave={scheduleCloseFlyout}
      >
        <div
          className={cn(
            "flex cursor-default items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium",
            isActive || isOpen ? "bg-chip text-primary" : "text-primary hover:bg-chip"
          )}
        >
          <span className="truncate">{group.label}</span>
          <div className="flex shrink-0 items-center gap-1 text-tertiary">
            <span className="text-[11px]">{group.models.length}</span>
            <ChevronRight size={12} />
          </div>
        </div>

        {isOpen && (
          <div
            className="absolute left-full top-0 z-30 ml-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-line bg-input p-1.5 shadow-lg"
            onMouseEnter={() => openFlyout(group.key)}
            onMouseLeave={scheduleCloseFlyout}
          >
            {group.models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => selectModel(model.id)}
                className={cn(
                  "flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left hover:bg-chip",
                  model.id === value && "bg-chip"
                )}
              >
                <span className="text-[13px] font-medium text-primary">{model.name}</span>
                <span className="truncate text-[11.5px] text-tertiary">{model.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleMenu}
        className="flex w-[220px] items-center justify-between gap-1.5 rounded-[9px] bg-chip px-2.5 py-[7px] text-[13px] font-medium text-primary hover:opacity-80"
      >
        <span className="min-w-0 flex-1 truncate text-left">{current?.name ?? "모델 선택"}</span>
        <ChevronDown
          size={13}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute top-[38px] left-0 z-20 w-[240px] rounded-xl border border-line bg-input p-1.5 shadow-lg">
          {models.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-tertiary">
              사용 가능한 모델이 없습니다. 설정에서 추가해주세요.
            </div>
          )}

          {autoModels.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-line pb-1.5">
              {autoModels.map(renderAutoItem)}
            </div>
          )}

          {paidGroups.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1.5">
              <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary">
                유료
              </div>
              {paidGroups.map(renderProviderGroup)}
            </div>
          )}

          {freeGroups.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1.5">
              <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary">
                무료
              </div>
              {freeGroups.map(renderProviderGroup)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
