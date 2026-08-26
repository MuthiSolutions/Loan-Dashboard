import type { Loan } from "@/lib/types";
import { formatDate, formatFCFA } from "@/lib/loans";

export function ClosedLoanCard({ loan }: { loan: Loan }) {
  const collected = loan.amountPaid ?? loan.totalDue;
  const profitRealized = loan.totalDue - loan.principal;

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold text-[var(--ink)]">{loan.borrower}</p>
          <p className="mt-0.5 text-sm text-[var(--slate)]">{loan.purpose}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-soft)] px-3 py-1 text-xs font-semibold text-[var(--ok)]">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Repaid{loan.repaidOn ? ` ${formatDate(loan.repaidOn)}` : ""}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Principal" value={formatFCFA(loan.principal)} />
        <Stat label="Collected" value={formatFCFA(collected)} />
        <Stat label="Profit realized" value={formatFCFA(profitRealized)} tone="text-[var(--ok)]" />
        <Stat
          label="Disbursed → Repaid"
          value={`${loan.disbursedOn ? formatDate(loan.disbursedOn) : "—"} → ${loan.repaidOn ? formatDate(loan.repaidOn) : "—"}`}
        />
      </div>

      {loan.notes && loan.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--cream-2)] pt-4">
          {loan.notes.map((note) => (
            <li key={note} className="flex gap-2 text-xs text-[var(--slate-soft)]">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--azure)]" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-[var(--ink)]" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">{label}</p>
      <p className={`mt-0.5 font-semibold tabular ${tone}`}>{value}</p>
    </div>
  );
}
