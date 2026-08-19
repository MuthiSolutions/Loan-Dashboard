import type { Loan } from "@/data/loans";
import { daysUntilDue, formatDate, formatFCFA, getLoanState } from "@/lib/loans";

const DOT_COLOR = {
  overdue: "bg-[var(--danger)]",
  "due-soon": "bg-[var(--amber)]",
  "on-track": "bg-[var(--ok)]",
} as const;

export function Timeline({ loans }: { loans: Loan[] }) {
  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <p className="eyebrow text-[11px]">Deadlines</p>
      <ol className="mt-4 space-y-0">
        {loans.map((loan, i) => {
          const state = getLoanState(loan);
          const days = daysUntilDue(loan);
          const label =
            state === "overdue"
              ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
              : days === 0
              ? "Due today"
              : `In ${days} day${days === 1 ? "" : "s"}`;

          return (
            <li key={loan.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < loans.length - 1 && (
                <span className="absolute top-3 left-[5px] h-full w-px bg-[var(--cream-2)]" />
              )}
              <span className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[state]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="font-medium text-[var(--ink)]">{loan.borrower.split(" — ")[0]}</p>
                  <p className="text-sm text-[var(--slate-soft)]">{formatDate(loan.dueOn)}</p>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm text-[var(--slate-soft)]">{label}</p>
                  <p className="text-sm font-semibold tabular text-[var(--ink)]">{formatFCFA(loan.totalDue)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
