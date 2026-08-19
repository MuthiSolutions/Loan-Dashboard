import type { LoanState } from "@/lib/loans";

const STYLES: Record<LoanState, string> = {
  overdue: "bg-[var(--danger-soft)] text-[var(--danger)]",
  "due-soon": "bg-[#f4e6c8] text-[var(--amber)]",
  "on-track": "bg-[var(--ok-soft)] text-[var(--ok)]",
};

const LABELS: Record<LoanState, string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  "on-track": "On track",
};

export function StatusBadge({ state, days }: { state: LoanState; days: number }) {
  const detail =
    state === "overdue"
      ? `${Math.abs(days)}d overdue`
      : days === 0
      ? "Due today"
      : `${days}d left`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STYLES[state]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[state]} · {detail}
    </span>
  );
}
