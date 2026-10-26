# Roadmap

Six one-week sprints, aligned with the schedule in the proposal. Week 1 starts when the
contract is signed; the dates below assume Monday 26 October 2026 and move with the signature.

## How each week works

| When | What |
|---|---|
| Monday | Planning (30 min): pick the demo goal and the issues for the week. |
| Monday to Thursday | One issue per working session: plan → approval → branch → code and tests → review → merge. |
| Thursday afternoon | Freeze, full check, deploy to staging. |
| Friday | 30-minute demo to Agrosoy on staging. Feedback becomes issues for next Monday. |

An issue is **done** when its rules have tests, CI passes, it works on staging and
[progress](progress.md) mentions it.

## Weeks

| Week | Dates | Build | Friday demo |
|---|---|---|---|
| S1 | 26–30 Oct | Foundation (steps 0.1–0.9 below), users and roles (M1), navigable account-statement preview with spreadsheet data | Login, users, statement preview |
| S2 | 2–6 Nov (Mon 2 is a holiday) | Customers and portfolio (M2), products, presentations and prices (M3), campaigns (M4), import of customers and products, first delivery-note draft | Catalogs with real data |
| S3 | 9–13 Nov | Delivery notes with PDF (M5), collections and exchange rates (M6), account statement (M7), migration of sales and payments with reconciliation | **Milestone: notes, collections and statement with real data** (second payment) |
| S4 | 16–20 Nov | Warehouses, lots, kardex, transfers and counts (M8), purchasing (M9) | Inventory |
| S5 | 23–27 Nov | Reports, exports and notifications (M11), travel allowances (M10), QA starts | Reports |
| S6 | 30 Nov–4 Dec | QA, final migration, production on Agrosoy's subdomain, training, acceptance | **Final delivery** (third payment) |

If the schedule slips, the milestone in week 3 keeps its scope; part of the 14 reports and the
travel-allowance module move first.

## Foundation steps (week 1)

| Step | Content | Status |
|---|---|---|
| 0.1 | Remove the first exploratory scaffold | Done |
| 0.2 | Repository and Next.js base | Done |
| 0.3 | Glossary, domain model, decisions, roadmap | In review |
| 0.4 | Tooling: strict TypeScript, ESLint layer rules, Prettier, Vitest, CI, commit hook | Pending |
| 0.5 | Local Postgres in Docker, Drizzle, migrations, audit log | Pending |
| 0.6 | Shared kernel: `Money`, `Quantity`, `ExchangeRate`, errors, text normalization | Pending |
| 0.7 | Staging on the VPS: Docker image, Caddy, backups, deploy from CI | Pending |
| 0.8 | Authentication and roles with Better Auth (M1) | Pending |
| 0.9 | Customers as the reference module for the rest | Pending |
