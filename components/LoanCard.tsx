import type { Loan } from "@/data/loans";
import {
  computeAmountDue,
  computeProfit,
  contractedProfit,
  daysUntilDue,
  formatDate,
  formatFCFA,
  getLoanState,
  weeksLate,
} from "@/lib/loans";
import { StatusBadge } from "./StatusBadge";

export function LoanCard({ loan }: { loan: Loan }) {
  const state = getLoanState(loan);
  const days = daysUntilDue(loan);
  const amountNow = computeAmountDue(loan);
  const weeks = weeksLate(loan);
  const feesTotal = loan.fees.reduce((sum, f) => sum + f.amount, 0);
  const profitNow = computeProfit(loan);
  const profitAtContract = contractedProfit(loan);

  const amountTone =
    state === "overdue" ? "text-[var(--danger)]" : state === "due-soon" ? "text-[var(--amber)]" : "text-[var(--ink)]";

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-semibold text-[var(--ink)]">{loan.borrower}</p>
            {loan.relatedParty && (
              <span className="rounded-full bg-[#f4e6c8] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--amber)]">
                Related party
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--slate)]">{loan.purpose}</p>
        </div>
        <StatusBadge state={state} days={days} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Principal" value={formatFCFA(loan.principal)} />
        <Stat label="Fees" value={feesTotal > 0 ? formatFCFA(feesTotal) : "—"} />
        <Stat label="Contracted total" value={formatFCFA(loan.totalDue)} />
        <Stat
          label="Currently owed"
          value={formatFCFA(amountNow)}
          valueClassName={`tabular ${amountTone}`}
          hint={weeks > 0 ? `incl. ${weeks} wk${weeks > 1 ? "s" : ""} × 1% late penalty` : undefined}
        />
        <Stat
          label="Profit"
          value={formatFCFA(profitNow)}
          valueClassName="tabular text-[var(--ok)]"
          hint={profitNow !== profitAtContract ? `${formatFCFA(profitAtContract)} at contract` : "principal returns, this is the gain"}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-1 border-t border-[var(--cream-2)] pt-4 text-sm text-[var(--slate-soft)]">
        {loan.disbursedOn && <span>Disbursed {formatDate(loan.disbursedOn)}</span>}
        <span>Due {formatDate(loan.dueOn)}</span>
        {loan.contact && <span>{loan.contact}</span>}
        <span>{loan.contractRef}</span>
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

function Stat({
  label,
  value,
  hint,
  valueClassName = "text-[var(--ink)]",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">{label}</p>
      <p className={`mt-0.5 font-semibold tabular ${valueClassName}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--slate-soft)]">{hint}</p>}
    </div>
  );
}
