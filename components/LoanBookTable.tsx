import type { Loan } from "@/lib/types";
import {
  computeAmountDue,
  computeProfit,
  formatFCFA,
  getLoanState,
  revolvingBorrowers,
} from "@/lib/loans";

/**
 * The status-first loan book, one line per loan — the same view as the front sheet of the exported
 * Excel workbook (borrower, what was lent, total due, received, still owed, profit, status, and
 * whether the borrower is on the 12-month revolving facility). Figures are live: penalties and
 * status re-accrue against `asOf`.
 */
export function LoanBookTable({
  loans,
  asOf = new Date(),
  recycledIds = new Set<string>(),
}: {
  loans: Loan[];
  asOf?: Date;
  /** Ids of re-lent cycles (same capital a borrower already repaid) — flagged so their principal isn't read as new money. */
  recycledIds?: Set<string>;
}) {
  const enrolled = revolvingBorrowers(loans);
  const hasRecycled = loans.some((l) => recycledIds.has(l.id));

  const statusOf = (loan: Loan) => {
    const state = getLoanState(loan, asOf);
    if (state === "overdue") return { label: "OVERDUE", cls: "bg-[var(--danger-soft)] text-[var(--danger)]" };
    if (state === "due-soon") return { label: "Due soon", cls: "bg-[#f4e6c8] text-[var(--amber)]" };
    return { label: "On track", cls: "bg-[var(--ok-soft)] text-[var(--ok)]" };
  };

  const totals = loans.reduce(
    (acc, l) => {
      acc.lent += l.principal;
      acc.due += l.totalDue;
      acc.received += l.amountPaid ?? 0;
      acc.owed += computeAmountDue(l, asOf);
      acc.profit += computeProfit(l, asOf);
      return acc;
    },
    { lent: 0, due: 0, received: 0, owed: 0, profit: 0 }
  );

  return (
    <div className="space-y-2">
    <div className="overflow-x-auto rounded-2xl border border-[var(--sapphire-line)] bg-white shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--sapphire)] text-left text-[var(--paper)]">
            <Th>Borrower</Th>
            <Th className="text-right">Lent</Th>
            <Th className="text-right">Total due</Th>
            <Th className="text-right">Received</Th>
            <Th className="text-right">Still owed</Th>
            <Th className="text-right">Profit</Th>
            <Th className="text-center">Status</Th>
            <Th>12-month facility</Th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => {
            const st = statusOf(loan);
            const received = loan.amountPaid ?? 0;
            const owed = computeAmountDue(loan, asOf);
            const rev = enrolled.has(loan.borrower);
            return (
              <tr key={loan.id} className="border-t border-[var(--cream-2)] align-top">
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--ink)]">{loan.borrower}</p>
                    {recycledIds.has(loan.id) && (
                      <span
                        className="rounded-full bg-[var(--cream-2)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--slate)] uppercase"
                        title="Re-lent: the same capital the borrower already repaid, not new money"
                      >
                        re-lent
                      </span>
                    )}
                  </div>
                  {loan.purpose && <p className="mt-0.5 text-xs text-[var(--slate-soft)]">{loan.purpose}</p>}
                </Td>
                <Td
                  className={`text-right tabular ${recycledIds.has(loan.id) ? "italic text-[var(--slate-soft)]" : "text-[var(--azure-deep)]"}`}
                  title={recycledIds.has(loan.id) ? "Re-lent — same capital recycled, not new money deployed" : undefined}
                >
                  {formatFCFA(loan.principal)}
                </Td>
                <Td className="text-right tabular text-[var(--azure-deep)]">{formatFCFA(loan.totalDue)}</Td>
                <Td className="text-right tabular text-[var(--slate)]">{received > 0 ? formatFCFA(received) : "—"}</Td>
                <Td className={`text-right tabular font-semibold ${owed > 0 ? "text-[var(--ink)]" : "text-[var(--slate-soft)]"}`}>
                  {owed > 0 ? formatFCFA(owed) : "—"}
                </Td>
                <Td className="text-right tabular font-semibold text-[var(--ok)]">{formatFCFA(computeProfit(loan, asOf))}</Td>
                <Td className="text-center">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                </Td>
                <Td className={rev ? "text-[var(--ok)]" : "text-[var(--slate-soft)]"}>
                  {rev ? "Yes — on the facility" : "Not enrolled"}
                </Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--sapphire-line)] bg-[var(--cream-2)]/50 font-semibold">
            <Td className="text-[var(--ink)]">Total ({loans.length})</Td>
            <Td className="text-right tabular text-[var(--ink)]">{formatFCFA(totals.lent)}</Td>
            <Td className="text-right tabular text-[var(--ink)]">{formatFCFA(totals.due)}</Td>
            <Td className="text-right tabular text-[var(--ink)]">{totals.received > 0 ? formatFCFA(totals.received) : "—"}</Td>
            <Td className="text-right tabular text-[var(--ink)]">{formatFCFA(totals.owed)}</Td>
            <Td className="text-right tabular text-[var(--ok)]">{formatFCFA(totals.profit)}</Td>
            <Td />
            <Td />
          </tr>
        </tfoot>
      </table>
    </div>
      {hasRecycled && (
        <p className="px-1 text-xs text-[var(--slate-soft)]">
          <span className="font-semibold">Re-lent</span> marks a cycle funded by capital the borrower already repaid
          (the revolving facility). It is outstanding now, but it is the same money going out again, not new principal —
          so it is never counted as fresh capital twice.
        </p>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-xs font-semibold tracking-wide uppercase ${className}`}>{children}</th>;
}

function Td({ children, className = "", title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return (
    <td className={`px-4 py-3 ${className}`} title={title}>
      {children}
    </td>
  );
}
