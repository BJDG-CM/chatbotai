import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Conversation, ImageAttachment, Message } from "./types";
import { getBrowserStorage, truncateTitle } from "./utils";
import { DEFAULT_MODEL_ID } from "./defaultModels";
import { useSettingsStore } from "./settingsStore";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  hydrateFromServer: (conversations: Conversation[], activeId: string | null) => void;
  createConversation: (model?: string) => string;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  setActiveId: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  appendToMessage: (conversationId: string, messageId: string, delta: string) => void;
  appendMessageImages: (conversationId: string, messageId: string, images: ImageAttachment[]) => void;
  setMessageModel: (conversationId: string, messageId: string, model: string) => void;
  setMessageError: (conversationId: string, messageId: string, error: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setConversationModel: (conversationId: string, model: string) => void;
  maybeSetTitleFromFirstMessage: (conversationId: string, text: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      hydrateFromServer: (conversations, activeId) => set({ conversations, activeId }),

      createConversation: (model) => {
        const id = nanoid();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: "새 대화",
          messages: [],
          model: model ?? DEFAULT_MODEL_ID,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const remaining = state.conversations.filter((c) => c.id !== id);
          const activeId =
            state.activeId === id ? remaining[0]?.id ?? null : state.activeId;
          return { conversations: remaining, activeId };
        });
      },

      clearAllConversations: () => set({ conversations: [], activeId: null }),

      setActiveId: (id) => set({ activeId: id }),

      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
              : c
          ),
        }));
      },

      appendToMessage: (conversationId, messageId, delta) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content: m.content + delta } : m
                  ),
                }
              : c
          ),
        }));
      },

      appendMessageImages: (conversationId, messageId, images) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === messageId
                      ? { ...m, images: [...(m.images ?? []), ...images] }
                      : m
                  ),
                }
              : c
          ),
        }));
      },

      setMessageModel: (conversationId, messageId, model) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, model } : m
                  ),
                }
              : c
          ),
        }));
      },

      setMessageError: (conversationId, messageId, error) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, error } : m
                  ),
                }
              : c
          ),
        }));
      },

      removeMessage: (conversationId, messageId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
              : c
          ),
        }));
      },

      setConversationModel: (conversationId, model) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, model } : c
          ),
        }));
      },

      maybeSetTitleFromFirstMessage: (conversationId, text) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) return;
        if (conversation.messages.length > 1) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, title: truncateTitle(text) } : c
          ),
        }));
      },

      renameConversation: (conversationId, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, title: title || "새 대화" } : c
          ),
        }));
      },
    }),
    {
      name: "chatbotai-conversations",
      storage: createJSONStorage(() => {
        const base = getBrowserStorage();
        return {
          getItem: (name) => base.getItem(name),
          removeItem: (name) => base.removeItem(name),
          // Ephemeral mode: freeze whatever was last saved instead of overwriting it,
          // so turning history-saving back on doesn't require losing older conversations.
          setItem: (name, value) => {
            if (!useSettingsStore.getState().saveHistory) return;
            base.setItem(name, value);
          },
        };
      }),
      partialize: (state) => ({
        conversations: state.conversations,
        activeId: state.activeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (typeof window === "undefined" || state.conversations.length > 0) {
          state.setHasHydrated(true);
          return;
        }
        // Local storage came back empty (first run, or cleared) — check for a
        // local file backup before deciding there's really nothing to restore.
        fetch("/api/history")
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { conversations?: Conversation[]; activeId?: string | null } | null) => {
            if (data?.conversations && data.conversations.length > 0) {
              useChatStore.getState().hydrateFromServer(data.conversations, data.activeId ?? null);
            }
          })
          .catch(() => {
            // no server backup available, proceed with empty state
          })
          .finally(() => {
            useChatStore.getState().setHasHydrated(true);
          });
      },
    }
  )
);
