"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";

const SYNC_DEBOUNCE_MS = 1500;

export default function HistorySync() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const chatHydrated = useChatStore((s) => s.hasHydrated);
  const saveHistory = useSettingsStore((s) => s.saveHistory);
  const settingsHydrated = useSettingsStore((s) => s.hasHydrated);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!chatHydrated || !settingsHydrated || !saveHistory) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversations, activeId }),
      }).catch(() => {
        // best-effort local backup; a failed write here shouldn't break the UI
      });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [conversations, activeId, chatHydrated, settingsHydrated, saveHistory]);

  return null;
}
