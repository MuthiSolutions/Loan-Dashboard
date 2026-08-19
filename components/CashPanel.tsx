import type { CashPosition } from "@/data/loans";
import { formatFCFA } from "@/lib/loans";

export function CashPanel({ cash }: { cash: CashPosition }) {
  const total = cash.inBank + cash.heldByFounder;

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-[var(--sapphire)] p-6 text-[var(--paper)] shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow text-[11px] text-[var(--azure-soft)]">Cash position — ready to deploy</p>
        <p className="font-display text-3xl font-semibold tabular">{formatFCFA(total)}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs tracking-wide text-[var(--mist)] uppercase">In bank</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatFCFA(cash.inBank)}</p>
          <p className="mt-1 text-xs text-[var(--mist-soft)]">Liquid, available now</p>
        </div>
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs tracking-wide text-[var(--mist)] uppercase">Held by founder</p>
          <p className="mt-1 text-xl font-semibold tabular">{formatFCFA(cash.heldByFounder)}</p>
          <p className="mt-1 text-xs text-[var(--mist-soft)]">{cash.heldByFounderNote}</p>
        </div>
      </div>
    </div>
  );
}
