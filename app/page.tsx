import { getActiveLoans, getCashPosition, getCommissions, getPipelineEntries } from "@/lib/repo";
import { formatFCFA, portfolioTotals } from "@/lib/loans";
import { Header } from "@/components/Header";

// Live figures on the cards (cash, outstanding, pending) must be computed per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const asOf = new Date();
  const [activeLoans, pipeline, cashPosition, commissions] = await Promise.all([
    getActiveLoans(),
    getPipelineEntries(),
    getCashPosition(),
    getCommissions(),
  ]);

  const totals = portfolioTotals(activeLoans, asOf);
  const totalCash = cashPosition.inBank + cashPosition.heldByFounder;
  const payable = commissions.filter((c) => c.status === "payable").reduce((s, c) => s + c.amount, 0);
  const toRelease = pipeline.reduce((s, e) => s + e.principal, 0);

  const views = [
    {
      href: "/dashboard",
      label: "Dashboard",
      blurb: "Cash position, portfolio health and what needs attention.",
      figure: formatFCFA(totals.totalCurrentlyOwed),
      figureLabel: "outstanding",
      tone: totals.overdueCount > 0 ? "danger" : "azure",
    },
    {
      href: "/loan-book",
      label: "Loan Book",
      blurb: "Every loan on one line — repaid or not, and who is on the revolving facility.",
      figure: `${totals.activeCount}`,
      figureLabel: "active loans",
      tone: "default",
    },
    {
      href: "/commissions",
      label: "Analyst Commissions",
      blurb: "20% of profit to Louis and Emmanuel — paid and still to collect.",
      figure: formatFCFA(payable),
      figureLabel: "still to collect",
      tone: payable > 0 ? "amber" : "ok",
    },
    {
      href: "/ledger",
      label: "Ledger",
      blurb: "Every cash movement in debit/credit form, per account.",
      figure: formatFCFA(totalCash),
      figureLabel: "total cash",
      tone: "default",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/" />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div>
          <p className="eyebrow text-[11px]">Muthi Solutions — internal</p>
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">What do you want to see?</h2>
        </div>

        {pipeline.length > 0 && (
          <a
            href="/dashboard"
            className="block rounded-2xl border border-[#e6cf93] bg-[#fbf3de] p-5 transition hover:brightness-[0.99]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--amber)]">
                {pipeline.length} pending disbursement{pipeline.length > 1 ? "s" : ""} — up to {formatFCFA(toRelease)} to release
              </p>
              <span className="text-xs font-medium text-[var(--amber)]">View on dashboard →</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--slate)]">
              {pipeline.map((e) => (
                <li key={e.id}>
                  <span className="font-medium text-[var(--ink)]">{e.kind === "term" ? e.label : e.borrower}</span>{" "}
                  — {formatFCFA(e.principal)} · {e.status}
                </li>
              ))}
            </ul>
          </a>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((v) => (
            <a
              key={v.href}
              href={v.href}
              className="group flex flex-col justify-between rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <p className="font-display text-xl font-semibold text-[var(--ink)]">{v.label}</p>
                <p className="mt-1.5 text-sm text-[var(--slate-soft)]">{v.blurb}</p>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className={`font-display text-2xl font-semibold tabular ${toneClass(v.tone)}`}>{v.figure}</p>
                  <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">{v.figureLabel}</p>
                </div>
                <span className="text-[var(--azure-deep)] transition group-hover:translate-x-0.5">→</span>
              </div>
            </a>
          ))}
        </section>

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential loan terms and borrower information. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}

function toneClass(tone: string): string {
  switch (tone) {
    case "danger":
      return "text-[var(--danger)]";
    case "amber":
      return "text-[var(--amber)]";
    case "ok":
      return "text-[var(--ok)]";
    case "azure":
      return "text-[var(--azure-deep)]";
    default:
      return "text-[var(--ink)]";
  }
}
