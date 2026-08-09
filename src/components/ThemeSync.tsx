"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/settingsStore";

export default function ThemeSync() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [fontSize, hasHydrated]);

  return null;
}
