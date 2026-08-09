import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { ModelOption } from "./types";
import { getBrowserStorage } from "./utils";
import {
  DEFAULT_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from "./defaultModels";

export type FontSize = "sm" | "md" | "lg";

interface SettingsState {
  models: ModelOption[];
  selectedModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  darkMode: boolean;
  fontSize: FontSize;
  saveHistory: boolean;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addModel: (model: Omit<ModelOption, "id"> & { id?: string }) => void;
  updateModel: (id: string, patch: Partial<ModelOption>) => void;
  removeModel: (id: string) => void;
  setSelectedModel: (id: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setTemperature: (t: number) => void;
  setMaxTokens: (value: number | null) => void;
  setTopP: (value: number | null) => void;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
  setFontSize: (size: FontSize) => void;
  setSaveHistory: (value: boolean) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      models: DEFAULT_MODELS,
      selectedModel: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: null,
      topP: null,
      darkMode: false,
      fontSize: "md",
      saveHistory: true,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      addModel: (model) => {
        const id = model.id?.trim() || nanoid();
        set((state) => ({ models: [...state.models, { id, name: model.name || id }] }));
      },

      updateModel: (id, patch) => {
        set((state) => ({
          models: state.models.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },

      removeModel: (id) => {
        set((state) => {
          const models = state.models.filter((m) => m.id !== id);
          const selectedModel =
            state.selectedModel === id
              ? models[0]?.id ?? DEFAULT_MODEL_ID
              : state.selectedModel;
          return { models, selectedModel };
        });
      },

      setSelectedModel: (id) => set({ selectedModel: id }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
      setTemperature: (t) => set({ temperature: t }),
      setMaxTokens: (value) => set({ maxTokens: value }),
      setTopP: (value) => set({ topP: value }),
      setDarkMode: (value) => set({ darkMode: value }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setFontSize: (size) => set({ fontSize: size }),
      setSaveHistory: (value) => set({ saveHistory: value }),

      resetToDefaults: () => {
        const currentSelected = get().selectedModel;
        const stillExists = DEFAULT_MODELS.some((m) => m.id === currentSelected);
        set({
          models: DEFAULT_MODELS,
          selectedModel: stillExists ? currentSelected : DEFAULT_MODEL_ID,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          temperature: DEFAULT_TEMPERATURE,
          maxTokens: null,
          topP: null,
        });
      },
    }),
    {
      name: "chatbotai-settings",
      storage: createJSONStorage(() => getBrowserStorage()),
      partialize: (state) => ({
        models: state.models,
        selectedModel: state.selectedModel,
        systemPrompt: state.systemPrompt,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        topP: state.topP,
        darkMode: state.darkMode,
        fontSize: state.fontSize,
        saveHistory: state.saveHistory,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
