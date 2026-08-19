# Muthi Solutions — Loan Portfolio Dashboard

Internal, password-gated dashboard tracking Muthi's outstanding loans, deadlines, and deployable cash. Separate from the public muthisolutions.com site — never deploy this under that project.

## Updating loan data

All loan facts live in [`data/loans.ts`](data/loans.ts):

- `loans` — active, disbursed loans (principal, fees, total due, dates, late-penalty rate)
- `pipeline` — loans under negotiation, not yet signed/disbursed
- `cashPosition` — bank balance and any amount held elsewhere pending return

Edit that file when a new contract is signed, a loan is repaid (remove it or add a `repaidOn` note), or terms change. Everything else — status badges, days-until-due, accrued late penalties, portfolio totals — is computed live in [`lib/loans.ts`](lib/loans.ts) from those facts, so the dashboard always reflects today's date without further edits.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Local password is set in `.env.local` (`DASHBOARD_PASSWORD`, gitignored) — currently `muthi-dev`.

## Access

Single shared password, set via the `DASHBOARD_PASSWORD` environment variable. No password configured = dashboard is unreachable (fails closed). Session is a 30-day cookie; use the "Log out" button in the header to clear it.

## Deploying to Railway

This repo is a plain Next.js app — Railway's Nixpacks builder detects it automatically, no Dockerfile needed.

1. `railway login` (make sure you're logged into the dedicated Muthi Railway account, not a personal one)
2. From this directory: `railway init` (create/link a project), then `railway up`
3. In the Railway project settings, set the `DASHBOARD_PASSWORD` environment variable to the real shared password
4. Railway auto-assigns a domain under `*.up.railway.app`; a custom domain can be attached later in project settings

## Roadmap

- In-app editable form for adding/updating loans (currently: send a contract in chat, the data file gets updated and redeployed)
- Possible future move under `muthisolutions.com/admin` once the main site has real login/credential infrastructure
