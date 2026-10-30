# Roadmap

Six one-week sprints, aligned with the schedule in the proposal. The contract is signed and week 1
starts on Monday 26 October 2026.

## How each week works

| When               | What                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| Monday             | Planning (30 min): pick the demo goal and the issues for the week.             |
| Monday to Thursday | One task per working session, committed to `main` once `pnpm check` passes.    |
| Thursday afternoon | Freeze, full check, deploy to staging.                                         |
| Friday             | 30-minute demo to Agrosoy on staging. Feedback becomes issues for next Monday. |

An issue is **done** when its rules have tests, CI passes, it works on staging and
[progress](progress.md) mentions it.

## Weeks

| Week | Dates                        | Build                                                                                                                                              | Friday demo                                                                     |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| S1   | 26–30 Oct                    | Foundation (steps 0.1–0.9 below), users and roles (M1), navigable account-statement preview with spreadsheet data                                  | Login, users, statement preview                                                 |
| S2   | 2–6 Nov (Mon 2 is a holiday) | Customers and portfolio (M2), products, presentations and prices (M3), campaigns (M4), import of customers and products, first delivery-note draft | Catalogs with real data                                                         |
| S3   | 9–13 Nov                     | Delivery notes with PDF (M5), collections and exchange rates (M6), account statement (M7), migration of sales and payments with reconciliation     | **Milestone: notes, collections and statement with real data** (second payment) |
| S4   | 16–20 Nov                    | Warehouses, lots, kardex, transfers and counts (M8), purchasing (M9)                                                                               | Inventory                                                                       |
| S5   | 23–27 Nov                    | Reports, exports and notifications (M11), travel allowances (M10), QA starts                                                                       | Reports                                                                         |
| S6   | 30 Nov–4 Dec                 | QA, final migration, production on Agrosoy's subdomain, training, acceptance                                                                       | **Final delivery** (third payment)                                              |

If the schedule slips, the milestone in week 3 keeps its scope; part of the 14 reports and the
travel-allowance module move first.

## Added after Agrosoy's answers (30 Oct 2026)

Each item goes on its week's branch (`main` is week 1) and flows forward by merge.

| Week | Added                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | Users' position and CI, technicians' zone of work (D26, D30); import of Agrosoy's customer list once it arrives (D29)                                                                                                                                                                                       |
| S2   | Codes per presentation with Agrosoy's numbers, unit presentations, inactive products, import of `PRODUCTOS.xlsx` with its prices as general reference prices (D23); carrier and "handed over by" on notes (D26); copy reference prices from the previous campaign                                           |
| S3   | Note and receipt PDFs like the paper forms, company profile (D26); receipt balances (D27); printed receipt numbers and the system's own number range (D28); returns and transfers from several deliveries (D25); charge concepts (D24); opening balances, historical notes and payments, cut-off date (D29) |
| S4   | "Handed over by" defaults to the warehouse keeper; notes before the cut-off take no stock (D29)                                                                                                                                                                                                             |
| S5   | Travel allowances as weekly reports with approval, monthly limit and vehicles (D30)                                                                                                                                                                                                                         |
| S6   | Agrosoy loads its own data (customers, products, opening balances, consigned notes) with a guide, instead of the spreadsheet migration (D29)                                                                                                                                                                |

## Foundation steps (week 1)

| Step | Content                                                                           | Status                           |
| ---- | --------------------------------------------------------------------------------- | -------------------------------- |
| 0.1  | Remove the first exploratory scaffold                                             | Done                             |
| 0.2  | Repository and Next.js base                                                       | Done                             |
| 0.3  | Glossary, domain model, decisions, roadmap                                        | Done                             |
| 0.4  | Tooling: strict TypeScript, ESLint layer rules, Prettier, Vitest, CI, commit hook | Done                             |
| 0.5  | Local Postgres in Docker, Drizzle, migrations, audit log                          | Done                             |
| 0.6  | Shared kernel: `Money`, `Quantity`, `ExchangeRate`, errors, text normalization    | Done                             |
| 0.7  | Staging on the VPS: Docker image, shared nginx, backups, deploy from CI           | Staging up by IP; domain pending |
| 0.8  | Authentication and roles with Better Auth (M1)                                    | Done                             |
| 0.9  | Customers as the reference module for the rest                                    | Done                             |
