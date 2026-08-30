"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { appPath } from "@/lib/paths";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(appPath("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error ?? "로그인하지 못했습니다.");
        return;
      }
      window.location.assign(appPath("/"));
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-sm rounded-2xl border border-line bg-input p-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-text">
          <LockKeyhole size={19} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-primary">Yejun&apos;s Private Chat</h1>
          <p className="mt-1 text-xs leading-relaxed text-secondary">허용된 개인 계정으로 로그인해 주세요.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-secondary">
          사용자명
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            maxLength={128}
            className="rounded-lg border border-line bg-app px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-secondary">
          비밀번호
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={256}
            className="rounded-lg border border-line bg-app px-3 py-2.5 text-sm text-primary outline-none transition focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "확인 중…" : "로그인"}
        </button>
      </form>
    </section>
  );
}
