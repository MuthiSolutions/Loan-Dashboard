import { getActiveLoans, getCommissions, getRepaidLoans } from "@/lib/repo";
import { loanNumbersByBorrower } from "@/lib/loans";
import { CommissionsPanel } from "@/components/CommissionsPanel";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const asOf = new Date();
  const [activeLoans, repaidLoans, commissions] = await Promise.all([
    getActiveLoans(),
    getRepaidLoans(),
    getCommissions(),
  ]);

  const allLoans = [...activeLoans, ...repaidLoans];
  const loanNumbers = loanNumbersByBorrower(allLoans);
  const loansById = new Map(allLoans.map((l) => [l.id, l]));
  const commissionRows = commissions.map((c) => ({
    ...c,
    borrower: loansById.get(c.loanId)?.borrower ?? c.loanId,
    loanNumber: loanNumbers.get(c.loanId)?.number,
  }));

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/commissions" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="eyebrow text-[11px]">Analyst fees</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Analyst Commissions</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--slate-soft)]">
            20% of the profit on the loans Louis and Emmanuel referred, to the two of them. Loans brought in through JP's
            own network carry no analyst commission. Payable is the part still with JP, who was advanced the fees and
            settles afterwards — it is deliberately not a cash movement, so it stays out of the balances.
          </p>
        </div>

        {commissionRows.length > 0 ? (
          <CommissionsPanel commissions={commissionRows} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--azure)]/40 bg-[var(--cream-2)]/50 p-6 text-sm text-[var(--slate-soft)]">
            No commissions recorded yet.
          </div>
        )}

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}
