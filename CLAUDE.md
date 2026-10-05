@AGENTS.md

# Muthi Solutions — Loan Portfolio Dashboard

Internal, password-gated tool tracking Muthi's real outstanding loans, cash position, and
credit scoring. This is confidential financial data — it must never be merged into or
exposed on the public muthisolutions.com marketing site; this is a separate repo and
deployment on purpose.

## Standing rules

- **Notes must be plain and self-contained.** A loan's `notes` field must never cite an
  unexplained contract article/document ("per Article 6...") and must never read like a
  changelog entry narrating how a figure was derived or instructing a future maintainer
  ("updated from X to Y because..."). A note is something a reader with no other context
  can understand on its own — state the current fact, not its history.
- **Newer, more authoritative documents win.** When a freshly supplied document (signed
  convention, reconnaissance de dette, a direct chat correction from the founder) conflicts
  with what's already on file, the newer/more authoritative source wins — but surface the
  discrepancy to the user rather than silently reconciling it. This has happened more than
  once (PRAÏA's draft vs. signed convention; Ane's fiche vs. his signed convention).
- **Gross vs. net amounts stay separate.** `grossAmountDue()` (full deal value — the profit
  basis) and `computeAmountDue()` (net of payments received — the collections figure) are
  deliberately different functions in `lib/loans.ts`. Profit must reference gross, never
  net, so a partial payment doesn't make a deal look smaller than it is.
- **Cash balances are never hand-set.** `cash_movements` is the only source of truth for
  "in bank" / "held by founder" — both are `SUM(amount)` over that table. Never edit a
  balance directly. A transfer between Muthi's own accounts (e.g. the founder handing cash
  to the bank) needs one row on each account sharing the same `transfer_id`, so the UI
  collapses them into a single "Founder → Bank" line instead of a debit and a credit that
  net to zero and read as two unrelated entries.
- **Never `railway up`.** Deploys are GitHub-triggered (push to `master` auto-deploys via
  Railway's connected service). A manual `railway up` once deployed this app onto the
  Postgres service by accident and corrupted it. The Railway CLI is only for one-off DB
  scripts/debugging, never for deploying.
- **Verify before shipping**: `npx tsc --noEmit`, then `rm -rf .next && npm run build`,
  then check the actual numbers in a browser (log in, spot-check whatever changed) before
  committing. Both machines/accounts share the same Postgres database (`DATABASE_URL` in
  `.env.local`, not committed), so a schema or data change is visible everywhere immediately
  — no separate migration step between environments.
- One-off data-fix/seed scripts live in `scripts/` and get committed (not deleted after
  running) so there's an audit trail of what changed and why.

## Capital: new money versus recycled money

The founder tracks these separately, because the business model is to keep re-lending the
same principal and earn the fee each time. Gross principal deployed flatters that badly.

- **Own money put in, as at 28 September 2026: 6,150,000 FCFA.** This is the agreed baseline
  and the figure to quote. It is every principal disbursed to that date except Marie Andréa
  Koizan's renewable cycle 1, which re-lent the 300,000 she had just repaid.
- **New money** is capital the founders had to find. **Recycled money** is a disbursement
  funded by principal a borrower had already handed back.
- From 28 September 2026 onward, every new disbursement is classified as one or the other
  when it is recorded, and the running total of own money is carried forward from 6,150,000.
- Gross principal deployed is a different number and should not be presented as money put in.
  At the baseline date it was 6,450,000.
- A first-principles recomputation from disbursement and repayment dates gives 6,000,000 of
  new money, because it also treats Ane Jean Philippe's 150,000 in August as recycled from
  Ouattara-Boni's repayment three days earlier. The founder's 6,150,000 is the adopted
  figure. Ouattara-Boni was an interest-free related-party loan, so counting its return as
  own capital rather than as recycled lending capital is reasonable. Do not silently switch
  between the two numbers.

## Analyst commissions

Louis and Emmanuel take **20% of the profit** on every loan as the analyst fee. It lives in
the `commissions` table, one row per loan, with `basis_profit` recording the profit figure
the rate was applied to so the arithmetic stays checkable if a loan is later restated.

- `status = 'paid'` means the money has reached the analysts **and** there is a matching
  outflow in `cash_movements`. Do not mark a commission paid without that movement.
- `status = 'payable'` means it is owed but still with JP, who was advanced the fees and
  settles with us afterwards. A payable commission is **not** a cash movement and must stay
  out of the cash position, or the balances book money that has not moved.
- PRAÏA is the one exception to the 20%: a flat 300,000 agreed for that deal, which works out
  at 17.9% of the 1,680,000 profit collected. It came out of the final 680,000 the borrower
  sent on 9 September, 300,000 to the analysts and 380,000 to JP.
- The fee is computed on **realised** profit, which includes late penalties collected. Do not
  use the contracted profit.

## Late penalty

The standard penalty is 1% per started week on the **total due** (not the principal), simple, never
compounded. A few loans are 1% per day by separate agreement with the borrower
(`late_penalty_period = 'day'`).

A loan's cadence can change mid-life. `late_penalty_switch_on` + `late_penalty_period_after` express
"accrue at the original cadence up to this date, then at the new cadence after it," same 1% rate
throughout. The penalty is simple within each phase, but the later phase accrues on the balance the
earlier one left, not on the original total due — so the phases multiply, `totalDue * (1 + rate *
phase1Units) * (1 + rate * phase2Units)`; they do not just add their units. Jean Philippe
(`ane-jean-philippe`) is the first: one weekly grace week took what he owed to 202,000, then 1% per
day from 2 October 2026 charged on that 202,000 (2,020/day). Do not model a cadence change by flipping
`late_penalty_period` outright — that would charge the grace week at the daily rate and overstate the
debt. `penaltyBreakdown()` gives the per-phase units and `formulaAmountDue()` applies them, in
`lib/loans.ts`, the single source of truth; the xlsx builder mirrors both.

## Where things live

- `lib/schema.sql` — canonical DB schema (source of truth; `scripts/migrate.mjs` is a
  one-time bootstrap seed, deliberately not kept in sync with later manual edits).
- `lib/types.ts` — shared TypeScript interfaces.
- `lib/repo.ts` — all DB queries.
- `lib/loans.ts` — pure computation (amounts due, penalties, portfolio totals).
- `lib/creditScore.ts` — the transparent, point-based credit scoring model.
- `proxy.ts` — the shared-password login gate (fails closed if `DASHBOARD_PASSWORD` unset).

## App structure (routes)

The dashboard opens on a **hub** at `/` where you choose a view — there is no longer one catch-all page.

- `/` — hub: a card per view, plus a pending-disbursements strip.
- `/dashboard` — cash position, portfolio KPIs, needs-attention, and the Pending disbursements panel.
- `/loan-book` — the status-first loan book table (one line per loan, mirroring the exported workbook's
  front sheet via `isRevolvingLoan`/`revolvingBorrowers` in `lib/loans.ts`), with full per-loan cards and
  closed loans below.
- `/borrowers` — credit scores and the scoring rubric.
- `/commissions` — analyst commissions.
- `/ledger` — cash movements in debit/credit form. The loan book is deliberately its own view, not folded
  in here.
- `/loans/new` — add a deal.

Pre-disbursement deals are `kind IN ('pipeline_term','pipeline_pending')` and surface under Pending
disbursements until funded; a `pipeline_pending` row with no `total_due` is a request whose terms are not
yet set. There is no Deadlines page — it was removed.
