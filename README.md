# Muthi Solutions — Loan Portfolio Dashboard

Internal, password-gated dashboard tracking Muthi's outstanding loans, deadlines, deployable cash, per-deal profit, and a first-pass credit scoring exercise. Separate from the public muthisolutions.com site — never deploy this under that project. Linked to the Railway project `skillful-benevolence` (Postgres add-on + the `romantic-expression` app service) under the `emmanuel@muthisolutions.com` account, deploying from `github.com/MuthiSolutions/Loan-Dashboard` (push to `master` → auto-deploy).

## Data model

Everything lives in Postgres (`lib/schema.sql`), not in a code file:

- **`loans`** — one table, a `kind` column (`active`, `pipeline_term`, `pipeline_pending`) covering all three loan shapes, plus payment-tracking columns (`amount_paid`, `last_payment_on`, `repaid_on`) and borrower-profile columns (`profession`, `employer`, `employment_type`, `monthly_income`, `tenure_years`) used by the credit scoring page.
- **`cash_movements`** — every cash inflow/outflow, signed, tagged to an account (`bank` or `founder`) and optionally a `loan_id`. "In bank" and "held by founder" are `SUM(amount)` over this table — never a hand-maintained number, so they can't drift out of sync with what's actually happened. The old `cash_position` table is superseded and left unused rather than dropped.

`lib/repo.ts` maps rows to the app's TypeScript types (`lib/types.ts`); `lib/loans.ts` holds the pure computation (status badges, days-until-due, accrued late penalties, profit vs. outstanding balance, portfolio totals) — all computed live from the DB facts and today's real date, so the dashboard never goes stale on its own.

**Profit vs. outstanding balance:** `grossAmountDue()` is the full value of a deal (what profit is measured against — unaffected by partial payments). `computeAmountDue()` is the outstanding balance (gross minus `amount_paid` — the actual collections figure). A partial payment should never make a deal's profit look smaller than it is.

**Updating a deal:**
- Through the UI: "+ Add a deal" on the dashboard opens `/loans/new`, covering active loans, pipeline (awaiting disbursement), and pipeline (term negotiation). Submits to `POST /api/loans`.
- By hand (edits to an existing deal, recording a payment, a cash movement, a manual pin): query Postgres directly — `railway connect Postgres`, or any Postgres client using the connection string in `.env.local`. `lib/repo.ts` exports `recordCashMovement()` for this if scripting it.
- Contracts/fiches: not uploadable from the form yet — drop the file in `public/documents/` and add a `{label, path}` entry to that loan's `documents` JSONB column.

`scripts/migrate.mjs` creates the schema and seeds an opening loan book + opening cash balances — safe to re-run (`ON CONFLICT DO NOTHING`), but it's a bootstrap snapshot, not a live mirror; don't expect it to reflect every subsequent manual edit.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Needs two vars in `.env.local` (gitignored):
- `DASHBOARD_PASSWORD` — currently `muthi-dev`
- `DATABASE_URL` — points at the Railway Postgres via its public TCP proxy (`altaria.proxy.rlwy.net:13551`), since local dev isn't inside Railway's private network

## Access

Single shared password, set via the `DASHBOARD_PASSWORD` environment variable. No password configured = dashboard is unreachable (fails closed). Session is a 30-day cookie; use the "Log out" button in the header to clear it. The same gate covers every route — `/deadlines`, `/borrowers`, `/loans/new`, `/api/loans`, and everything under `/documents/`.

## Deploying

GitHub-connected — push to `master` and Railway auto-deploys the `romantic-expression` service. No manual `railway up` needed day-to-day (that CLI-upload path is what caused a service mixup once; avoid it going forward). To check a deploy:

```bash
railway service status --service romantic-expression --json
railway logs --service romantic-expression
```

`DATABASE_URL` on the app service references Postgres internally (`${{Postgres.DATABASE_URL}}`), not the public proxy — the app runs inside the same private network. Domain is Railway's default `*.up.railway.app`; a custom domain can be attached later in project settings.

## Roadmap

- Document upload directly from the "add a deal" form (currently: drop the file in `public/documents/` by hand)
- Editing an existing loan, and recording a payment/cash movement, from the UI (currently: add-only from the form; everything else goes through Postgres directly)
- Surface `getRepaidLoans()` somewhere (a "recently repaid" section) — the data's tracked, just not shown yet
- Possible future move under `muthisolutions.com/admin` once the main site has real login/credential infrastructure
