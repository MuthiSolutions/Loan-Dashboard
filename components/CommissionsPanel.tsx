import type { Commission } from "@/lib/types";
import { formatDate, formatFCFA } from "@/lib/loans";

export interface CommissionRow extends Commission {
  /** Borrower the loan was made to, for a line that reads without cross-referencing ids. */
  borrower: string;
  loanNumber?: number;
}

/**
 * The analyst fee Louis and Emmanuel take on each loan's profit.
 *
 * Payable is listed before paid and totalled separately, because payable is the part that
 * still has to be collected: those fees were advanced to JP directly and come back to us
 * afterwards. A payable commission is not a cash movement, so it is deliberately absent from
 * the cash position above — showing it there would count money that has not moved.
 */
export function CommissionsPanel({ commissions }: { commissions: CommissionRow[] }) {
  if (commissions.length === 0) return null;

  const payable = commissions.filter((c) => c.status === "payable");
  const paid = commissions.filter((c) => c.status === "paid");
  const payableTotal = payable.reduce((sum, c) => sum + c.amount, 0);
  const paidTotal = paid.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-[11px]">Analyst commissions</p>
          <p className="mt-1 text-sm text-[var(--slate-soft)]">
            20% of the profit on the loans Louis and Emmanuel referred
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-xs text-[var(--slate-soft)]">
            Still to collect{" "}
            <span className="tabular text-base font-semibold text-[var(--amber)]">{formatFCFA(payableTotal)}</span>
          </span>
          <span className="text-xs text-[var(--slate-soft)]">
            Already paid{" "}
            <span className="tabular text-base font-semibold text-[var(--ok)]">{formatFCFA(paidTotal)}</span>
          </span>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-[var(--cream-2)]">
        {[...payable, ...paid].map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-x-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{c.borrower}</p>
                {c.loanNumber !== undefined && (
                  <span className="rounded-full bg-[var(--cream-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--slate)]">
                    Loan #{c.loanNumber}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    c.status === "paid"
                      ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                      : "bg-[#f4e6c8] text-[var(--amber)]"
                  }`}
                >
                  {c.status === "paid" ? `Paid${c.paidOn ? ` ${formatDate(c.paidOn)}` : ""}` : "Payable"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--slate-soft)]">
                {c.rate !== undefined
                  ? `${Math.round(c.rate * 100)}% of ${formatFCFA(c.basisProfit)} profit`
                  : `Agreed outright on ${formatFCFA(c.basisProfit)} profit`}
                {" · "}
                {c.beneficiaries}
              </p>
              {c.notes.map((note) => (
                <p key={note} className="mt-0.5 text-xs text-[var(--slate-soft)]">
                  {note}
                </p>
              ))}
            </div>
            <p
              className={`shrink-0 font-semibold tabular ${
                c.status === "paid" ? "text-[var(--slate)]" : "text-[var(--ink)]"
              }`}
            >
              {formatFCFA(c.amount)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
