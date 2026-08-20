# Muthi Solutions — Loan Portfolio Dashboard

Internal, password-gated dashboard tracking Muthi's outstanding loans, deadlines, deployable cash, and per-deal profit. Separate from the public muthisolutions.com site — never deploy this under that project. Linked to the Railway project `skillful-benevolence` (with a Postgres add-on) under the `emmanuel@muthisolutions.com` account.

## Data model

The loan book lives in Postgres (`lib/schema.sql`), not in a code file — a single `loans` table with a `kind` column (`active`, `pipeline_term`, `pipeline_pending`) covering all three loan shapes, plus a one-row `cash_position` table. `lib/repo.ts` maps rows to the app's TypeScript types (`lib/types.ts`); `lib/loans.ts` holds the pure computation (status badges, days-until-due, accrued late penalties, profit, portfolio totals) — all computed live from the DB facts, so the dashboard always reflects today's date without manual edits.

**Updating a deal:**
- Through the UI: the "+ Add a deal" button on the dashboard opens `/loans/new`, a form covering active loans, pipeline (awaiting disbursement), and pipeline (term negotiation). Submits to `POST /api/loans`.
- By hand (for edits to an existing deal, or a manual pin like `manual_amount_override`): query Postgres directly, e.g. via `railway connect Postgres` or any Postgres client using the connection string in `.env.local`.
- Contracts/fiches: not uploadable from the form yet — drop the PDF in `public/documents/` and add a `{label, path}` entry to that loan's `documents` JSONB column.

`scripts/migrate.mjs` creates the schema and was used once to seed the initial loan book — safe to re-run (`ON CONFLICT DO NOTHING`), not part of normal operation.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Needs two vars in `.env.local` (gitignored):
- `DASHBOARD_PASSWORD` — currently `muthi-dev`
- `DATABASE_URL` — points at the Railway Postgres via its public TCP proxy (`altaria.proxy.rlwy.net:13551`), since local dev isn't inside Railway's private network

## Access

Single shared password, set via the `DASHBOARD_PASSWORD` environment variable. No password configured = dashboard is unreachable (fails closed). Session is a 30-day cookie; use the "Log out" button in the header to clear it. The same gate covers `/loans/new`, `/api/loans`, and everything under `/documents/`.

## Deploying to Railway

This repo is a plain Next.js app — Railway's Nixpacks builder detects it automatically, no Dockerfile needed. The Postgres database already exists in the linked project (`skillful-benevolence`).

1. `railway login` if not already authenticated as `emmanuel@muthisolutions.com`
2. From this directory: `railway up` (already linked to the right project/service)
3. In the app service's variables, set `DASHBOARD_PASSWORD` (real shared password) and `DATABASE_URL` — reference the Postgres service internally with `${{Postgres.DATABASE_URL}}` rather than the public proxy URL, since the app runs inside the same private network
4. Railway auto-assigns a domain under `*.up.railway.app`; a custom domain can be attached later in project settings

## Roadmap

- Document upload directly from the "add a deal" form (currently: drop the file in `public/documents/` by hand)
- Editing/repaying an existing loan from the UI (currently: add-only from the form; edits go through Postgres directly)
- Possible future move under `muthisolutions.com/admin` once the main site has real login/credential infrastructure
