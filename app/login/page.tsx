"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--sapphire-deep)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <div>
            <p className="eyebrow text-[11px]">Muthi Solutions</p>
            <p className="font-display text-lg font-semibold text-[var(--ink)]">Loan Portfolio</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-[var(--slate)]">
          Internal &amp; confidential. Enter the shared password to continue.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input
            type="password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-[var(--cream-2)] bg-[var(--cream)] px-4 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--azure)]"
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--azure-deep)] px-4 py-2.5 font-semibold text-[var(--paper)] transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
