import type { CashMovement } from "@/lib/types";
import { formatDate, formatFCFA } from "@/lib/loans";

/**
 * Standard accounting convention for an asset account (bank/cash): an inflow is a Debit
 * (the balance increases), an outflow is a Credit (the balance decreases). This is the
 * opposite of everyday language ("credited my account" for money coming in) but is the
 * correct formal convention — see CLAUDE.md.
 */
export function LedgerTable({ title, movements }: { title: string; movements: CashMovement[] }) {
  const sorted = [...movements].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id - b.id);

  let running = 0;
  const rows = sorted.map((m) => {
    running += m.amount;
    return { ...m, balance: running };
  });

  const totalDebit = sorted.filter((m) => m.amount > 0).reduce((sum, m) => sum + m.amount, 0);
  const totalCredit = sorted.filter((m) => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0);

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--cream-2)] px-6 py-4">
        <h3 className="font-display text-lg font-semibold text-[var(--ink)]">{title}</h3>
        <p className="font-display text-xl font-semibold tabular text-[var(--ink)]">{formatFCFA(running)}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--cream-2)] text-left text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">
              <th className="px-6 py-2 font-medium">Date</th>
              <th className="px-6 py-2 font-medium">Description</th>
              <th className="px-6 py-2 text-right font-medium">Debit</th>
              <th className="px-6 py-2 text-right font-medium">Credit</th>
              <th className="px-6 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-[var(--slate-soft)]">
                  No movements recorded yet.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-[var(--cream-2)] last:border-0">
                <td className="px-6 py-2.5 whitespace-nowrap text-[var(--slate-soft)]">{formatDate(m.occurredOn)}</td>
                <td className="px-6 py-2.5 text-[var(--slate)]">{m.description}</td>
                <td className="px-6 py-2.5 text-right tabular text-[var(--ok)]">{m.amount > 0 ? formatFCFA(m.amount) : ""}</td>
                <td className="px-6 py-2.5 text-right tabular text-[var(--danger)]">{m.amount < 0 ? formatFCFA(Math.abs(m.amount)) : ""}</td>
                <td className="px-6 py-2.5 text-right tabular font-medium text-[var(--ink)]">{formatFCFA(m.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--sapphire-line)] text-sm font-semibold">
              <td className="px-6 py-3" colSpan={2}>
                Totals
              </td>
              <td className="px-6 py-3 text-right tabular text-[var(--ok)]">{formatFCFA(totalDebit)}</td>
              <td className="px-6 py-3 text-right tabular text-[var(--danger)]">{formatFCFA(totalCredit)}</td>
              <td className="px-6 py-3 text-right tabular text-[var(--ink)]">{formatFCFA(running)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
