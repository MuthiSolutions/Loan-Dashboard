import type { PipelineLoan } from "@/data/loans";
import { formatFCFA } from "@/lib/loans";

export function PipelinePanel({ loans }: { loans: PipelineLoan[] }) {
  if (loans.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dashed border-[var(--azure)]/40 bg-[var(--cream-2)]/60 p-6">
      <p className="eyebrow text-[11px]">Pipeline — not yet in the outstanding book</p>
      <div className="mt-4 space-y-4">
        {loans.map((loan) => {
          const totalRepayment = loan.monthlyPayment * loan.termMonths;
          return (
            <div key={loan.id} className="rounded-xl bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display text-base font-semibold text-[var(--ink)]">{loan.label}</p>
                <span className="rounded-full bg-[#f4e6c8] px-3 py-1 text-xs font-semibold text-[var(--amber)]">
                  {loan.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">Principal</p>
                  <p className="mt-0.5 font-semibold tabular text-[var(--ink)]">{formatFCFA(loan.principal)}</p>
                </div>
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">Deferral</p>
                  <p className="mt-0.5 font-semibold tabular text-[var(--ink)]">{loan.deferralMonths} mo</p>
                </div>
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">Monthly</p>
                  <p className="mt-0.5 font-semibold tabular text-[var(--ink)]">
                    {formatFCFA(loan.monthlyPayment)} × {loan.termMonths}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">If signed, total</p>
                  <p className="mt-0.5 font-semibold tabular text-[var(--azure-deep)]">{formatFCFA(totalRepayment)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
