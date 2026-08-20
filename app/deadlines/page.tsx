import { getActiveLoans } from "@/lib/repo";
import { CalendarView } from "@/components/CalendarView";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function DeadlinesPage() {
  const asOf = new Date();
  const loans = await getActiveLoans();

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/deadlines" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-[11px]">Deadlines</p>
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Repayment calendar</h2>
          </div>
          <a href="/" className="text-sm text-[var(--azure-deep)] hover:underline">
            ← Back to dashboard
          </a>
        </div>

        <CalendarView loans={loans} asOf={asOf} />
      </main>
    </div>
  );
}
