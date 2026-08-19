"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-[var(--sapphire-line)] px-4 py-1.5 text-sm font-medium text-[var(--paper)] transition hover:bg-white/10"
    >
      Log out
    </button>
  );
}
