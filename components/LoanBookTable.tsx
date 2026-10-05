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
export function LoanBookTable({ loans, asOf = new Date() }: { loans: Loan[]; asOf?: Date }) {
  const enrolled = revolvingBorrowers(loans);

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
                  <p className="font-semibold text-[var(--ink)]">{loan.borrower}</p>
                  {loan.purpose && <p className="mt-0.5 text-xs text-[var(--slate-soft)]">{loan.purpose}</p>}
                </Td>
                <Td className="text-right tabular text-[var(--azure-deep)]">{formatFCFA(loan.principal)}</Td>
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
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-xs font-semibold tracking-wide uppercase ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
