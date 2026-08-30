"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Moon, Plus, Settings, Sun, Trash2 } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settingsStore";
import { cn } from "@/lib/utils";
import { appPath } from "@/lib/paths";

export default function Sidebar() {
  const pathname = usePathname();
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setActiveId = useChatStore((s) => s.setActiveId);
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const toggleDarkMode = useSettingsStore((s) => s.toggleDarkMode);

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  async function logout() {
    await fetch(appPath("/api/auth/logout"), { method: "POST" }).catch(() => null);
    window.location.assign(appPath("/login"));
  }

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col bg-sidebar border-r border-line p-3.5 dark:border-line">
      <div className="mb-4 flex items-center gap-2 px-1.5">
        <div className="h-[22px] w-[22px] shrink-0 rounded-[7px] bg-accent" />
        <span className="flex-1 text-[14.5px] font-semibold tracking-tight">Yejun&apos;s Chat</span>
        <button
          type="button"
          onClick={toggleDarkMode}
          title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-tertiary hover:bg-chip hover:text-primary"
        >
          {darkMode ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => createConversation(selectedModel)}
        className="mb-4 flex items-center gap-2 rounded-[10px] border border-line bg-input px-3 py-2.5 text-[13px] font-medium text-primary hover:opacity-80"
      >
        <Plus size={15} />
        새 대화
      </button>

      <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary">
        최근 대화
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {sorted.map((conv) => {
            const isActive = conv.id === activeId && pathname === "/";
            return (
              <li key={conv.id} className="group relative">
                <Link
                  href="/"
                  onClick={() => setActiveId(conv.id)}
                  className={cn(
                    "block truncate rounded-[9px] px-2.5 py-2.5 pr-8 text-[13px] leading-tight",
                    isActive
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-secondary hover:bg-chip"
                  )}
                >
                  {conv.title}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("이 대화를 삭제할까요?")) {
                      deleteConversation(conv.id);
                    }
                  }}
                  className="absolute right-1.5 top-1.5 hidden rounded p-1 text-tertiary hover:opacity-70 group-hover:block"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="px-2.5 py-2 text-xs text-tertiary">아직 대화가 없습니다.</li>
          )}
        </ul>
      </nav>

      <div className="mt-2.5 border-t border-line pt-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-chip",
            pathname === "/settings" && "bg-chip"
          )}
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
            나
          </div>
          <span className="flex-1 text-[13px] font-medium">사용자</span>
          <Settings size={14} className="text-tertiary" />
        </Link>
        <button
          type="button"
          onClick={logout}
          className="mt-1 flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-secondary hover:bg-chip hover:text-primary"
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center">
            <LogOut size={14} />
          </div>
          <span className="flex-1 text-left text-[13px] font-medium">로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
