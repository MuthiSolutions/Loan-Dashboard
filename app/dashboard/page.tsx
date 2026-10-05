import { getActiveLoans, getCashPosition, getPipelineEntries } from "@/lib/repo";
import { formatFCFA, portfolioTotals } from "@/lib/loans";
import { CashPanel } from "@/components/CashPanel";
import { Header } from "@/components/Header";
import { PendingDisbursements } from "@/components/PendingDisbursements";
import { SummaryCard } from "@/components/SummaryCard";

// Penalties accrue by the day and the loan book is DB-backed, so this page
// must be computed per-request, not cached at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const asOf = new Date();
  const [activeLoans, pipeline, cashPosition] = await Promise.all([
    getActiveLoans(),
    getPipelineEntries(),
    getCashPosition(),
  ]);

  const totals = portfolioTotals(activeLoans, asOf);
  const totalDeployable = cashPosition.inBank + cashPosition.heldByFounder;

  const attentionLabel =
    totals.overdueCount > 0
      ? `${totals.overdueCount} overdue`
      : totals.dueSoonCount > 0
      ? `${totals.dueSoonCount} due within 7 days`
      : "None";

  const attentionSub =
    totals.overdueCount > 0
      ? `${totals.overdueCount} loan${totals.overdueCount > 1 ? "s" : ""} past due date`
      : totals.dueSoonCount > 0
      ? "Due within the next 7 days"
      : "All loans on track";

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/dashboard" />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div>
          <p className="eyebrow text-[11px]">Overview</p>
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Dashboard</h2>
        </div>

        <PendingDisbursements entries={pipeline} />

        <CashPanel cash={cashPosition} deployedPrincipal={totals.netPrincipalAtRisk} />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard
            label="Cash on hand"
            value={formatFCFA(totalDeployable)}
            sub={`${formatFCFA(cashPosition.inBank)} bank + ${formatFCFA(cashPosition.heldByFounder)} with founder`}
            tone="azure"
          />
          <SummaryCard
            label="Principal at risk"
            value={formatFCFA(totals.netPrincipalAtRisk)}
            sub={`${totals.activeCount} active loans, net of principal already recovered`}
          />
          <SummaryCard
            label="Total outstanding"
            value={formatFCFA(totals.totalCurrentlyOwed)}
            sub="Principal + fees + penalties, net of payments received"
            tone={totals.overdueCount > 0 ? "danger" : "default"}
          />
          <SummaryCard
            label="Expected profit"
            value={formatFCFA(totals.totalProfit)}
            sub="Already counted inside Total outstanding"
            tone="ok"
          />
          <SummaryCard
            label="Needs attention"
            value={attentionLabel}
            sub={attentionSub}
            tone={totals.overdueCount > 0 ? "danger" : totals.dueSoonCount > 0 ? "default" : "ok"}
          />
        </section>

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential loan terms and borrower information. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}
