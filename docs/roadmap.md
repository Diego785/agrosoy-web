# Roadmap

Six one-week sprints, aligned with the schedule in the proposal. The contract is signed and week 1
starts on Monday 26 October 2026.

## How each week works

| When               | What                                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| Monday             | Planning (30 min): pick the demo goal and the issues for the week.              |
| Monday to Thursday | One task per working session, committed to `main` once `pnpm check` passes.     |
| Thursday afternoon | Freeze, full check, deploy to staging.                                          |
| Friday             | 30-minute demo to Agrosoil on staging. Feedback becomes issues for next Monday. |

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
| S6   | 30 Nov–4 Dec                 | QA, final migration, production on Agrosoil's subdomain, training, acceptance                                                                      | **Final delivery** (third payment)                                              |

If the schedule slips, the milestone in week 3 keeps its scope; part of the 14 reports and the
travel-allowance module move first.

## Added after Agrosoil's answers (30 Oct 2026)

Each item goes on its week's branch and flows forward by merge; `main` receives a week once it is
approved (weeks 1 and 2 by 31 October). S2's items are built (31 October); S1's customer import
waits for Agrosoil's list.

| Week | Added                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | Users' position and CI, technicians' zone of work (D26, D30); import of Agrosoil's customer list once it arrives (D29)                                                                                                                                                                                      |
| S2   | Codes per presentation with Agrosoil's numbers, unit presentations, inactive products, import of `PRODUCTOS.xlsx` with its prices as general reference prices (D23); carrier and "handed over by" on notes (D26); copy reference prices from the previous campaign                                          |
| S3   | Note and receipt PDFs like the paper forms, company profile (D26); receipt balances (D27); printed receipt numbers and the system's own number range (D28); returns and transfers from several deliveries (D25); charge concepts (D24); opening balances, historical notes and payments, cut-off date (D29) |
| S4   | "Handed over by" defaults to the warehouse keeper; notes before the cut-off take no stock (D29)                                                                                                                                                                                                             |
| S5   | Travel allowances as weekly reports with approval, monthly limit and vehicles (D30)                                                                                                                                                                                                                         |
| S6   | Agrosoil loads its own data (customers, products, opening balances, consigned notes) with a guide, instead of the spreadsheet migration (D29)                                                                                                                                                               |

## Added after the meeting of 7 November 2026

Recorded on 10 November. The changes that the proposal doesn't cover (due dates, automatic
interest, commercial value of free lines, withdrawals) go to Agrosoil for written approval in a
document next to the proposal, as its section 14 asks.

| Week | Added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3   | Due dates, extensions and overdue debt (D37); late-payment interest proposals (D38, to week 5 if week 3 runs short); bolivianos of every payment in the statement (D39); invoice number on confirmed notes and in the statement (D40); commercial value of free lines (D41); legal fees as a charge concept (D24); "Seguir el oficial" (D42); the spreadsheet import as the main way in (D43); zones Norte and Este and the customer's locality; voided notes out of the notes list unless filtered |
| S4   | Withdrawals held by the technician (D44), once Agrosoil's manager answers; the real warehouses (Cuatro Cañadas, San Pedro, San Pablo, Chiquitos; Yapacaní later); separate names for warehouse and campaign transfers                                                                                                                                                                                                                                                                               |
| S6   | Agrosoil imports its own full sheets (D43); opening balances only where there is no sheet                                                                                                                                                                                                                                                                                                                                                                                                           |

## Added after administration's audios and the customer lists (12–16 November 2026)

Administration's audios of 12 and 13 November settled interest (monthly, not once per due date) and
asked for payments to cover interest before capital. The eight technicians' customer lists arrived
on 16 November: 153 customers, listing only those who still owe. Everything here is free of charge
for Agrosoil; it goes into version 1.1 of the scope-change document for written approval.
Changes that the proposal's M2, M11 and M12 already cover are adjustments, not scope changes.

| Week | Added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4   | Load the lists: zones Norte and Este, the eight technicians as users, the 153 customers cleaned (one customer in two lists stays one; estates become their owner's properties; localities written one way). CI and NIT as separate fields, a foreign CI keeps its "E-". Locality suggests the ones already used. Change the technician of several customers at once. Import: link a sheet's name to an existing customer and remember it; an imported note takes its sheet's technician. Debt and collections per technician follow the notes, not the customer's current technician; a payment owed to two technicians goes to the oldest note first |
| S5   | Monthly interest (replaces D38's once-per-due-date rule and migrations 0023/0025, which never reached staging): the month after the due date is free with 30 days' grace, then 3 % of the capital still owed at the end of each month, one proposal line per month. Payments cover interest before capital, and the statement shows the split. The customer's usual terms (cash or credit), suggested on new notes. The photo of the signed note (M5), sharing file storage with the travel-allowance receipts                                                                                                                                        |
| S6   | Before the import of full sheets: the name links above must be in place                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Week 3's last gaps closed on 19 November: a cash note's payment takes a printed receipt number,
and a return asks who receives for Agrosoil and the carrier. The signed note's photo waits for S5,
where travel allowances bring the file storage both use. Waiting on Agrosoil: when 4.5 % applies instead of 3 %, whether
the month of payment is charged, and the owners of the estates "Suelo Rico" and "Palmarito II".

## Hotfix of 26 November 2026: correcting what a sheet brought in

Asked by administration on 26 November, in two audios and a screenshot of note "N.º 12333 (de
planilla)" (Solfiagro, winter 2026, 300 L of Fulvin 40-22 20 L at US$ 7.88):

- nothing a sheet brought in can be changed afterwards: not its notes, payments or returns;
- a technician sold at 36 what the system has at 37, and the customer complained;
- the system keeps prices with 2 decimals while Excel keeps 3 to 5 so that totals come out right,
  so the debt doesn't match the sheet;
- importing the whole sheet again for one customer isn't worth it. For today's urgent statement,
  administration undoes the sheet and imports it again corrected.

It goes out on its own, ahead of week 4, because staging already holds real imported sheets.

**Why, in the code:**

- A confirmed note is never edited (D6); the way out is voiding it. The note's page shows "Anular"
  only to notes with a system number, and an imported note keeps the sheet's number instead, so it
  has no button. That is a bug: the void itself accepts imported notes.
- The import reads the price with 2 decimals and recomputes each line as quantity × rounded price;
  a sheet total that differs is only reported as a warning (`LINE_TOTAL_MISMATCH`). 300 L at
  7.88 makes 2,364.00 where Excel's 7.8833… makes 2,365.00. Importing again rounds the same way.
- The sheet's payments and returns become ledger entries per customer (source `import_batch`); only
  "Deshacer" on the whole sheet reverses them.

**What the hotfix does (D60, numbered after week 4's D49–D59):**

| #   | Piece                               | What it includes                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Anular" on imported notes          | The button shows for them too and names "N.º 12333 (de planilla)"; a payment it cancels names the sheet's number instead of "N.º null". Undoing the sheet later skips notes already voided (already true).                                                                                                                                                                                                                            |
| 2   | Prices with up to 4 decimals        | A note line keeps its unit price with up to 4 decimals, typed or imported; its total rounds to the cent. The import keeps the sheet's price as written and, where the sheet has a line total, that total, so each note adds up to what Excel shows. Campaign price sheets stay at 2 decimals. Migration: `unit_price` numeric(14,4) on note lines and imported lines; returns and campaign transfers value lines with the same price. |
| 3   | Correct an imported note            | On a confirmed imported delivery, "Corregir" lets administration (`imports.manage`, whoever imports) change each line's quantity and unit price, with a reason. The note keeps its sheet number, date, customer and campaign; free lines (bonus, sample) keep price 0. Refused while the note has confirmed returns or campaign transfers, as voiding is.                                                                             |
| 4   | The debt follows the note           | The note's delivery entry is reversed and the new total posted, both dated the note's own date, so balances, aging and interest from then on use the corrected amount; the ledger stays append-only (D6) and the change log keeps the old and new prices and the reason. The statement shows the corrected lines once (the reversed pair stays off it).                                                                               |
| 5   | Correct a sheet's payments, returns | On "Conciliación con la planilla", each customer's row opens what the sheet brought in for them besides notes: its payments and returns, each with its date and amount. Administration changes an amount with a reason; that entry is reversed and posted again with the same date and kind. Today only undoing the whole sheet can.                                                                                                  |
| 6   | It shows                            | The note's page: "Corregida el 26/11/26 por YANINE: motivo"; the conciliation marks corrected customers. Interest already confirmed on an old amount is not recalculated; an "Ajuste de precio" covers it if needed.                                                                                                                                                                                                                  |
| 7   | Tests, check and ship               | Unit and integration tests; a browser check on a copy of staging; `hotfix/imported-note-correction` into `main` with the developer's OK and deployed alone (week 4's migrations don't go with it); then `main` merged forward into `feature/week-4`. Migrations: three nullable columns on `delivery_notes` (corrected at, by, reason), and the price's 4 decimals. About a day, plus the deploy.                                     |

**Built on 26 November** (D60); waiting for the developer's approval to ship.

**Left as it is:** notes with a system number are printed and handed over, so they are still voided
and done again; the correction is for imported notes only. Notes already imported keep the price
they were imported with; a sheet imported again after the hotfix comes in with Excel's decimals.

**Until it's deployed:** a wrong price or amount is fixed in the Excel, the sheet undone and imported
again (what administration does on 26 November); the cents a rounded price still leaves are balanced
with an "Ajuste de precio" in Cobros → Cargos (credit to lower the debt, debit to raise it).

## Foundation steps (week 1)

| Step | Content                                                                           | Status                            |
| ---- | --------------------------------------------------------------------------------- | --------------------------------- |
| 0.1  | Remove the first exploratory scaffold                                             | Done                              |
| 0.2  | Repository and Next.js base                                                       | Done                              |
| 0.3  | Glossary, domain model, decisions, roadmap                                        | Done                              |
| 0.4  | Tooling: strict TypeScript, ESLint layer rules, Prettier, Vitest, CI, commit hook | Done                              |
| 0.5  | Local Postgres in Docker, Drizzle, migrations, audit log                          | Done                              |
| 0.6  | Shared kernel: `Money`, `Quantity`, `ExchangeRate`, errors, text normalization    | Done                              |
| 0.7  | Staging on the VPS: Docker image, shared nginx, backups, deploy from CI           | Done; certificate renewal pending |
| 0.8  | Authentication and roles with Better Auth (M1)                                    | Done                              |
| 0.9  | Customers as the reference module for the rest                                    | Done                              |
