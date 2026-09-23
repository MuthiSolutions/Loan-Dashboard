import { CollapsibleSection } from "./CollapsibleSection";

const FACTORS = [
  {
    label: "Employment stability",
    max: 20,
    text: "A permanent contract (CDI) earns the full 20; a fixed-term contract about half; self-employed and informal work less. Not documented is neutral, not a penalty.",
  },
  {
    label: "Income coverage",
    max: 15,
    text: "How many times over the declared monthly income covers what is owed. Five times or more earns the full 15; income not declared is neutral.",
  },
  {
    label: "Repayment timing",
    max: 18,
    text: "Full marks for a loan that is on track or fully repaid. Every week overdue costs 6 points, so a month late wipes this out.",
  },
  {
    label: "Payment reliability",
    max: 15,
    text: "Starts full. Each broken promise costs 5; making an actual payment toward the debt earns 5 back. A borrower with no history yet keeps the full 15.",
  },
  {
    label: "Documentation on file",
    max: 8,
    text: "Two or more documents (fiche, convention, reconnaissance de dette) earns the full 8; one earns half.",
  },
  {
    label: "Job / business tenure",
    max: 8,
    text: "Five or more years earns the full 8. Not documented is neutral.",
  },
  {
    label: "Track record",
    max: 16,
    text: "Only a repeat borrower who has repaid two or more loans in full earns these 16 points. A single loan, however perfect, earns none here — one data point is not a pattern.",
  },
];

export function ScoringRubric() {
  return (
    <CollapsibleSection title={<p className="eyebrow text-[11px]">How the score is built</p>} defaultOpen>
      <div className="rounded-2xl border border-[var(--sapphire-line)] bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {FACTORS.map((f) => (
            <div key={f.label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-[var(--ink)]">{f.label}</p>
                <p className="shrink-0 text-xs tabular text-[var(--slate-soft)]">up to {f.max}</p>
              </div>
              <p className="mt-0.5 text-xs text-[var(--slate-soft)]">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-[var(--cream-2)] pt-5 md:grid-cols-2">
          <div>
            <p className="text-xs tracking-wide text-[var(--slate-soft)] uppercase">Grades</p>
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--slate)]">
              <li>
                <span className="font-semibold text-[var(--ok)]">A · 91 to 100</span> — a proven repeat borrower with a
                near-perfect file. The scale is capped at 95, so this is rare by design.
              </li>
              <li>
                <span className="font-semibold text-[var(--azure-deep)]">B+ · 85 to 90</span> — a repeat borrower. The six
                profile and behavior factors add up to 84 at most, so nobody gets here on a first loan.
              </li>
              <li>
                <span className="font-semibold text-[var(--azure-deep)]">B · 80 to 84</span> — very good. Where a strong
                first-time borrower lands.
              </li>
              <li>
                <span className="font-semibold text-[var(--amber)]">C · below 80</span> — not yet proven, or something on
                file to watch.
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs tracking-wide text-[var(--slate-soft)] uppercase">Two house rules</p>
            <ul className="mt-2 space-y-1.5 text-xs text-[var(--slate)]">
              <li>
                <span className="font-medium text-[var(--ink)]">Repay your first loan early, get a B.</span> A first-time
                borrower who settles in full ahead of their due date is held at 80 minimum, whatever the rest of their
                file says. First loan only — on later loans the file has to earn its score, so a slip can't be wiped out
                by repaying one loan early.
              </li>
              <li>
                <span className="font-medium text-[var(--ink)]">Nobody is 100%.</span> The score is capped at 95. No
                borrower is ever treated as risk-free, however good the signals.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
