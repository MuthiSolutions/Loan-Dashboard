import type { PipelineEntry } from "@/lib/types";
import { formatFCFA } from "@/lib/loans";

/**
 * Money about to go out, before it hits the active book: deals where a contract has been sent and we
 * are waiting on a signature to disburse, and fresh requests whose terms are not yet agreed. Kept
 * visible on the dashboard so upcoming disbursements and open requests are never out of sight. Each
 * card links through to its own detail page.
 */
export function PendingDisbursements({ entries }: { entries: PipelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--azure)]/40 bg-[var(--cream-2)]/50 p-6 text-sm text-[var(--slate-soft)]">
        Nothing pending — no contracts awaiting signature and no open requests.
      </div>
    );
  }

  // Everything to release if every pending deal and open request is funded at the amount on record.
  const toRelease = entries.reduce((sum, e) => sum + e.principal, 0);

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-[11px]">Pending disbursements</p>
          <p className="mt-1 text-sm text-[var(--slate-soft)]">Contracts awaiting signature and open requests — not yet in the book</p>
        </div>
        <span className="text-xs text-[var(--slate-soft)]">
          Up to{" "}
          <span className="tabular text-base font-semibold text-[var(--azure-deep)]">{formatFCFA(toRelease)}</span> to release
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <PendingCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function PendingCard({ entry }: { entry: PipelineEntry }) {
  const title = entry.kind === "term" ? entry.label : entry.borrower;
  const contact = entry.kind === "term" ? entry.contact : undefined;
  const feesTotal = entry.fees.reduce((sum, f) => sum + f.amount, 0);
  const totalToRepay = entry.kind === "pending" ? entry.totalDue : entry.principal + feesTotal;
  const termsSet = totalToRepay > 0;

  return (
    <a
      href={`/pending/${entry.id}`}
      className="group block rounded-xl border border-[var(--cream-2)] bg-[var(--cream)]/40 p-4 transition hover:border-[var(--azure)]/50 hover:bg-white hover:shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold text-[var(--ink)] group-hover:text-[var(--azure-deep)]">
            {title}
          </p>
          {entry.kind === "pending" && entry.purpose && (
            <p className="mt-0.5 text-sm text-[var(--slate-soft)]">{entry.purpose}</p>
          )}
          {contact && <p className="mt-0.5 text-sm text-[var(--slate-soft)]">{contact}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#f4e6c8] px-3 py-1 text-xs font-semibold text-[var(--amber)]">{entry.status}</span>
          <span className="text-[var(--azure-deep)] transition group-hover:translate-x-0.5">→</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
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

      {entry.documents && entry.documents.length > 0 && (
        <p className="mt-3 border-t border-[var(--cream-2)] pt-3 text-xs text-[var(--slate-soft)]">
          {entry.documents.length} document{entry.documents.length > 1 ? "s" : ""} on file — open to view
        </p>
      )}
    </a>
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
