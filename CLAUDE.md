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

## Where things live

- `lib/schema.sql` — canonical DB schema (source of truth; `scripts/migrate.mjs` is a
  one-time bootstrap seed, deliberately not kept in sync with later manual edits).
- `lib/types.ts` — shared TypeScript interfaces.
- `lib/repo.ts` — all DB queries.
- `lib/loans.ts` — pure computation (amounts due, penalties, portfolio totals).
- `lib/creditScore.ts` — the transparent, point-based credit scoring model.
- `proxy.ts` — the shared-password login gate (fails closed if `DASHBOARD_PASSWORD` unset).
