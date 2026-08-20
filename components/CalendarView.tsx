import type { Loan } from "@/lib/types";
import { computeAmountDue, formatFCFA, getLoanState } from "@/lib/loans";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-first weekday index: 0 = Monday .. 6 = Sunday. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function CalendarView({ loans, asOf }: { loans: Loan[]; asOf: Date }) {
  const allDates = [
    ...loans.map((l) => parseISODate(l.dueOn)),
    ...loans.filter((l) => l.finalDeadline).map((l) => parseISODate(l.finalDeadline!)),
    asOf,
  ];
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

  const months: { year: number; month: number }[] = [];
  let y = minDate.getFullYear();
  let m = minDate.getMonth();
  while (y < maxDate.getFullYear() || (y === maxDate.getFullYear() && m <= maxDate.getMonth())) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  if (loans.length === 0) {
    return <p className="text-sm text-[var(--slate-soft)]">No active loans to schedule yet.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--slate-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--danger-soft)] ring-1 ring-[var(--danger)]/40" /> Trailing unpaid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--danger)]" /> Final deadline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-[var(--azure)]" /> Today
        </span>
      </div>
      {months.map(({ year, month }) => (
        <CalendarMonth key={`${year}-${month}`} year={year} month={month} loans={loans} asOf={asOf} />
      ))}
    </div>
  );
}

function CalendarMonth({ year, month, loans, asOf }: { year: number; month: number; loans: Loan[]; asOf: Date }) {
  const first = new Date(year, month, 1);
  const numDays = daysInMonth(year, month);
  const leadingBlanks = mondayIndex(first);

  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = asOf.toDateString();

  return (
    <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
      <p className="font-display text-lg font-semibold text-[var(--ink)]">
        {MONTH_NAMES[month]} {year}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold tracking-wide text-[var(--slate-soft)] uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;

          const cellDate = new Date(year, month, day);
          const isToday = cellDate.toDateString() === todayKey;
          const dueToday = loans.filter((loan) => sameDate(parseISODate(loan.dueOn), cellDate));
          const deadlineToday = loans.filter((loan) => loan.finalDeadline && sameDate(parseISODate(loan.finalDeadline), cellDate));
          const inTrailingSpan = loans.some((loan) => {
            if (!loan.finalDeadline) return false;
            const due = parseISODate(loan.dueOn);
            const deadline = parseISODate(loan.finalDeadline);
            return cellDate > due && cellDate <= deadline;
          });

          const cellStyle = isToday
            ? "border-[var(--azure)] bg-[var(--paper)]"
            : inTrailingSpan
            ? "border-[var(--danger)]/30 bg-[var(--danger-soft)]/50"
            : "border-[var(--cream-2)]";

          return (
            <div key={i} className={`min-h-[84px] rounded-lg border p-1.5 text-left ${cellStyle}`}>
              <p
                className={`text-xs ${
                  isToday ? "font-bold text-[var(--azure-deep)]" : inTrailingSpan ? "font-semibold text-[var(--danger)]" : "text-[var(--slate-soft)]"
                }`}
              >
                {day}
              </p>
              <div className="mt-1 space-y-1">
                {dueToday.map((loan) => {
                  const state = getLoanState(loan, asOf);
                  const tone =
                    state === "overdue"
                      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                      : state === "due-soon"
                      ? "bg-[#f4e6c8] text-[var(--amber)]"
                      : "bg-[var(--ok-soft)] text-[var(--ok)]";
                  return (
                    <div key={loan.id} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${tone}`}>
                      <p className="truncate">{loan.borrower.split(" — ")[0]}</p>
                      <p className="tabular">{formatFCFA(loan.totalDue)}</p>
                    </div>
                  );
                })}
                {deadlineToday.map((loan) => (
                  <div key={`${loan.id}-deadline`} className="rounded bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">
                    <p className="uppercase tracking-wide opacity-80" style={{ fontSize: "8px" }}>
                      Final deadline
                    </p>
                    <p className="truncate">{loan.borrower.split(" — ")[0]}</p>
                    <p className="tabular">{formatFCFA(computeAmountDue(loan, cellDate))}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
