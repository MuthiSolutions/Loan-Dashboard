import type { LoanFee } from "@/lib/types";
import { formatFCFA } from "@/lib/loans";

interface ProfitBreakdownProps {
  principal: number;
  fees: LoanFee[];
  /** Used to synthesize a single fee line when `fees` is empty (e.g. a revenue-share deal with no itemized fees). */
  fallbackFeeLabel: string;
  contractedTotal: number;
  liveTotal: number;
  liveLabel: string;
}

export function ProfitBreakdown({ principal, fees, fallbackFeeLabel, contractedTotal, liveTotal, liveLabel }: ProfitBreakdownProps) {
  const contractedFees = contractedTotal - principal;
  const liveFees = liveTotal - principal;
  const lateAccrual = liveFees - contractedFees;
  const effectiveRate = principal > 0 ? (contractedFees / principal) * 100 : 0;
  const itemized = fees.length > 0 ? fees : [{ label: fallbackFeeLabel, amount: contractedFees }];

  return (
    <div className="mt-5 rounded-xl bg-[var(--ok-soft)]/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">Effective fee rate</p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular text-[var(--ink)]">{effectiveRate.toFixed(1)}%</p>
          <p className="text-[11px] text-[var(--slate-soft)]">on principal</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-wide text-[var(--slate-soft)] uppercase">{liveLabel}</p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular text-[var(--ok)]">{formatFCFA(liveTotal - principal)}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-white/60 pt-3">
        {itemized.map((fee) => (
          <li key={fee.label} className="flex items-center justify-between text-sm">
            <span className="text-[var(--slate)]">{fee.label}</span>
            <span className="font-medium tabular text-[var(--ink)]">{formatFCFA(fee.amount)}</span>
          </li>
        ))}
        {lateAccrual > 0 && (
          <li className="flex items-center justify-between text-sm">
            <span className="text-[var(--danger)]">Late penalty accrued</span>
            <span className="font-medium tabular text-[var(--danger)]">+{formatFCFA(lateAccrual)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
