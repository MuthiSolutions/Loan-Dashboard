import { getActiveLoans, getRepaidLoans } from "@/lib/repo";
import { loanNumbersByBorrower, loansSortedByUrgency, recycledLoanIds } from "@/lib/loans";
import { ClosedLoanCard } from "@/components/ClosedLoanCard";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Header } from "@/components/Header";
import { LoanBookTable } from "@/components/LoanBookTable";
import { LoanCard } from "@/components/LoanCard";

export const dynamic = "force-dynamic";

export default async function LoanBookPage() {
  const asOf = new Date();
  const [activeLoans, repaidLoans] = await Promise.all([getActiveLoans(), getRepaidLoans()]);

  const loans = loansSortedByUrgency(activeLoans, asOf);
  // Numbering needs every loan a borrower has ever had, active and repaid, or their
  // second loan would show as their first.
  const loanNumbers = loanNumbersByBorrower([...activeLoans, ...repaidLoans]);
  // Which active loans re-lend capital already repaid — needs every loan, repaid included, to see the earlier cycle.
  const recycledIds = recycledLoanIds([...activeLoans, ...repaidLoans]);

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/loan-book" />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-[11px]">Every loan, one line</p>
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Loan Book</h2>
          </div>
          <a
            href="/loans/new"
            className="rounded-full bg-[var(--azure-deep)] px-4 py-1.5 text-xs font-semibold text-[var(--paper)] transition hover:opacity-90"
          >
            + Add a deal
          </a>
        </div>

        <LoanBookTable loans={loans} asOf={asOf} recycledIds={recycledIds} />

        <CollapsibleSection title={<p className="eyebrow text-[11px]">Full detail, loan by loan</p>} defaultOpen={false}>
          <div className="space-y-4">
            {loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} loanNumber={loanNumbers.get(loan.id)?.number} />
            ))}
          </div>
        </CollapsibleSection>

        {repaidLoans.length > 0 && (
          <CollapsibleSection
            title={
              <p className="eyebrow text-[11px]">
                Closed loans{" "}
                <span className="text-[var(--slate-soft)] normal-case tracking-normal">({repaidLoans.length})</span>
              </p>
            }
            defaultOpen={false}
          >
            <div className="space-y-4">
              {repaidLoans.map((loan) => (
                <ClosedLoanCard key={loan.id} loan={loan} loanNumber={loanNumbers.get(loan.id)?.number} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential loan terms and borrower information. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}
