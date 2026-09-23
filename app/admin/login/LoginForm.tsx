"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(json.error ?? "Sign in failed");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-4 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-sm"
      >
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck size={24} />
          </span>
          <h1 className="text-lg font-semibold">OHC Admin</h1>
          <p className="mt-1 text-sm text-muted">Nuvoco Sonadih Cement Plant</p>
        </div>

        <div className="grid gap-4">
          <Field label="Admin password" required>
            <input
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {err && (
            <p className="rounded-lg bg-danger-soft p-2.5 text-sm text-danger">{err}</p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
    </div>
  );
}
