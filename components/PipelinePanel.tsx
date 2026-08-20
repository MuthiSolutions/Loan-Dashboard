import type { ReactNode } from "react";
import type { DocumentLink, PipelineEntry } from "@/lib/types";
import { formatFCFA } from "@/lib/loans";
import { DocumentLinks } from "./DocumentLinks";

export function PipelinePanel({ loans }: { loans: PipelineEntry[] }) {
  if (loans.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dashed border-[var(--azure)]/40 bg-[var(--cream-2)]/60 p-6">
      <p className="eyebrow text-[11px]">Pipeline — not yet in the outstanding book</p>
      <div className="mt-4 space-y-4">
        {loans.map((entry) =>
          entry.kind === "term" ? <TermEntry key={entry.id} entry={entry} /> : <PendingEntry key={entry.id} entry={entry} />
        )}
      </div>
    </div>
  );
}

function PipelineCard({
  title,
  status,
  contact,
  children,
  notes,
  documents,
}: {
  title: string;
  status: string;
  contact?: string;
  children: ReactNode;
  notes?: string[];
  documents?: DocumentLink[];
}) {
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold text-[var(--ink)]">{title}</p>
          {contact && <p className="mt-0.5 text-sm text-[var(--slate-soft)]">{contact}</p>}
        </div>
        <span className="rounded-full bg-[#f4e6c8] px-3 py-1 text-xs font-semibold text-[var(--amber)]">{status}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
      {notes && notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--cream-2)] pt-3">
          {notes.map((note) => (
            <li key={note} className="flex gap-2 text-xs text-[var(--slate-soft)]">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[var(--azure)]" />
              {note}
            </li>
          ))}
        </ul>
      )}
      <DocumentLinks documents={documents} />
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

function TermEntry({ entry }: { entry: Extract<PipelineEntry, { kind: "term" }> }) {
  const feesTotal = entry.fees.reduce((sum, f) => sum + f.amount, 0);
  const totalRepayment = entry.principal + feesTotal;
  const profitIfSigned = feesTotal;
  const impliedMonthly = Math.round(totalRepayment / entry.termMonths);

  return (
    <PipelineCard title={entry.label} status={entry.status} contact={entry.contact} notes={entry.notes} documents={entry.documents}>
      <Stat label="Principal" value={formatFCFA(entry.principal)} />
      <Stat label="Fees" value={formatFCFA(feesTotal)} />
      <Stat label="Deferral" value={`${entry.deferralMonths} mo`} />
      <Stat
        label="If signed, total"
        value={formatFCFA(totalRepayment)}
        tone="text-[var(--azure-deep)]"
      />
      <Stat label="Profit if signed" value={formatFCFA(profitIfSigned)} tone="text-[var(--ok)]" />
      <Stat label="≈ Monthly (implied)" value={`${formatFCFA(impliedMonthly)} × ${entry.termMonths}`} tone="text-[var(--slate-soft)]" />
    </PipelineCard>
  );
}

function PendingEntry({ entry }: { entry: Extract<PipelineEntry, { kind: "pending" }> }) {
  const feesTotal = entry.fees.reduce((sum, f) => sum + f.amount, 0);
  const profitIfDisbursed = entry.totalDue - entry.principal;

  return (
    <PipelineCard title={entry.borrower} status={entry.status} notes={entry.notes} documents={entry.documents}>
      {entry.requestedAmount && entry.requestedAmount !== entry.principal && (
        <Stat label="Requested" value={formatFCFA(entry.requestedAmount)} tone="text-[var(--slate-soft)]" />
      )}
      <Stat label="Approved principal" value={formatFCFA(entry.principal)} />
      <Stat label="Fees" value={feesTotal > 0 ? formatFCFA(feesTotal) : "—"} />
      <Stat label="If disbursed, total" value={formatFCFA(entry.totalDue)} tone="text-[var(--azure-deep)]" />
      <Stat label="Profit if disbursed" value={formatFCFA(profitIfDisbursed)} tone="text-[var(--ok)]" />
    </PipelineCard>
  );
}
