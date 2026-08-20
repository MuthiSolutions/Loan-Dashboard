import type { CreditScore, Grade } from "@/lib/creditScore";
import { formatFCFA } from "@/lib/loans";

const GRADE_STYLE: Record<Grade, { bg: string; fg: string; ring: string }> = {
  A: { bg: "bg-[var(--ok-soft)]", fg: "text-[var(--ok)]", ring: "ring-[var(--ok)]/30" },
  B: { bg: "bg-[var(--paper)]", fg: "text-[var(--azure-deep)]", ring: "ring-[var(--azure)]/30" },
  C: { bg: "bg-[#f4e6c8]", fg: "text-[var(--amber)]", ring: "ring-[var(--amber)]/30" },
  D: { bg: "bg-[var(--danger-soft)]", fg: "text-[var(--danger)]", ring: "ring-[var(--danger)]/30" },
};

export function BorrowerCard({
  name,
  subtitle,
  contact,
  amountLabel,
  amount,
  score,
}: {
  name: string;
  subtitle?: string;
  contact?: string;
  amountLabel: string;
  amount: number;
  score: CreditScore;
}) {
  const style = GRADE_STYLE[score.grade];

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-[var(--ink)]">{name}</p>
          {subtitle && <p className="mt-0.5 truncate text-sm text-[var(--slate)]">{subtitle}</p>}
          {contact && <p className="mt-0.5 text-xs text-[var(--slate-soft)]">{contact}</p>}
        </div>
        <div className={`flex shrink-0 flex-col items-center justify-center rounded-2xl ${style.bg} ring-1 ${style.ring} px-4 py-2`}>
          <p className={`font-display text-3xl font-bold leading-none ${style.fg}`}>{score.grade}</p>
          <p className={`mt-1 text-[11px] font-semibold tabular ${style.fg}`}>
            {score.total}/{score.maxTotal}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-[var(--cream-2)] pt-3">
        <p className="text-xs tracking-wide text-[var(--slate-soft)] uppercase">{amountLabel}</p>
        <p className="font-semibold tabular text-[var(--ink)]">{formatFCFA(amount)}</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {score.factors.map((f) => (
          <div key={f.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--slate)]">{f.label}</span>
              <span className="tabular text-[var(--slate-soft)]">
                {f.points}/{f.maxPoints}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--cream-2)]">
              <div className="h-full rounded-full bg-[var(--azure)]" style={{ width: `${(f.points / f.maxPoints) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--slate-soft)]">{f.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
