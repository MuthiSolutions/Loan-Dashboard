import { notFound } from "next/navigation";
import { getPipelineEntries } from "@/lib/repo";
import { formatFCFA } from "@/lib/loans";
import { DocumentLinks } from "@/components/DocumentLinks";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function PendingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asOf = new Date();
  const entry = (await getPipelineEntries()).find((e) => e.id === id);
  if (!entry) notFound();

  const title = entry.kind === "term" ? entry.label : entry.borrower;
  const contact = entry.kind === "term" ? entry.contact : undefined;
  const purpose = entry.kind === "pending" ? entry.purpose : undefined;
  const feesTotal = entry.fees.reduce((sum, f) => sum + f.amount, 0);
  const totalToRepay = entry.kind === "pending" ? entry.totalDue : entry.principal + feesTotal;
  const termsSet = totalToRepay > 0;

  const profile: [string, string | undefined][] = [
    ["Contact", contact],
    ["Profession", entry.profession],
    ["Employer", entry.employer],
    ["Employment", entry.employmentType],
    ["Monthly income", entry.monthlyIncome ? formatFCFA(entry.monthlyIncome) : undefined],
  ];

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <Header asOf={asOf} current="/dashboard" />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <a href="/dashboard" className="text-sm text-[var(--azure-deep)] hover:underline">
          ← Back to dashboard
        </a>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-[11px]">Pending disbursement</p>
            <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">{title}</h2>
            {purpose && <p className="mt-1 text-sm text-[var(--slate-soft)]">{purpose}</p>}
          </div>
          <span className="rounded-full bg-[#f4e6c8] px-3 py-1 text-xs font-semibold text-[var(--amber)]">{entry.status}</span>
        </div>

        <section className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
          <p className="eyebrow text-[11px]">The deal</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {entry.kind === "pending" && entry.requestedAmount !== undefined && (
              <Stat label="Requested" value={formatFCFA(entry.requestedAmount)} tone="text-[var(--slate-soft)]" />
            )}
            <Stat label="To release" value={formatFCFA(entry.principal)} />
            {termsSet ? (
              <>
                {feesTotal > 0 && <Stat label="Fee" value={formatFCFA(feesTotal)} tone="text-[var(--slate-soft)]" />}
                <Stat label="Total to repay" value={formatFCFA(totalToRepay)} tone="text-[var(--azure-deep)]" />
                {entry.kind === "term" && entry.termMonths > 0 && (
                  <Stat
                    label="Repayment"
                    value={`${entry.termMonths} × ${formatFCFA(Math.round(totalToRepay / entry.termMonths))}/mo`}
                    tone="text-[var(--slate-soft)]"
                  />
                )}
              </>
            ) : (
              <Stat label="Terms" value="Not yet set" tone="text-[var(--slate-soft)]" />
            )}
          </div>
        </section>

        {profile.some(([, v]) => v) && (
          <section className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
            <p className="eyebrow text-[11px]">Borrower</p>
            <dl className="mt-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
              {profile.map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-2 text-sm">
                    <dt className="w-32 shrink-0 text-[var(--slate-soft)]">{label}</dt>
                    <dd className="font-medium text-[var(--ink)]">{value}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </section>
        )}

        {entry.notes && entry.notes.length > 0 && (
          <section className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
            <p className="eyebrow text-[11px]">Notes</p>
            <ul className="mt-4 space-y-2">
              {entry.notes.map((note) => (
                <li key={note} className="flex gap-2 text-sm text-[var(--slate)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--azure)]" />
                  {note}
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.documents && entry.documents.length > 0 && (
          <section className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
            <p className="eyebrow text-[11px]">Paperwork</p>
            <DocumentLinks documents={entry.documents} />
          </section>
        )}

        <footer className="border-t border-[var(--cream-2)] pt-6 pb-4 text-xs text-[var(--slate-soft)]">
          Internal document — confidential. Do not share outside Muthi Solutions.
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "text-[var(--ink)]" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">{label}</p>
      <p className={`mt-0.5 font-semibold tabular ${tone}`}>{value}</p>
    </div>
  );
}
