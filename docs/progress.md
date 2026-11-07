# Progress

What has been done, newest first. Each working session adds an entry, so the next one can pick
up without re-reading the whole history.

## 2026-11-06

- **Optional exchange rate on credit notes (D35):** Agrosoil's sales manager says some customers have
  no rate until they pay. A note starts from the fixed rate or the day's rate; ticking "Se define al
  cobrar" blocks the field, and the note then shows only US$, on screen and in its PDF. Cash notes
  still require a rate. The sheet conversion keeps blank rates blank and no longer asks for a default.
  Migration `0018_optional_note_exchange_rate`.
- **The exchange rate in force (D36):** the last one recorded in Cobros stays until replaced and is
  suggested everywhere, unless the customer has a fixed rate. Cobros shows the official rate with its
  date and a button to adopt it. Not applied by itself; to ask Agrosoil where its rate comes from.
- **What Agrosoil will send:** each engineer sends a customer list by Monday 9 November. The sales
  manager enters the debts herself once someone explains how, which needs the opening-balance screen
  (D29).
- **Week 3 merged into `main`** with what it has so far (developer's approval), to deploy to staging
  for the meeting of Saturday 7 November. Week 3's list for 9–13 November (2026-11-05, below) stays on
  `feature/week-3`.

## 2026-11-05

Getting week 3 ready to preview on Saturday 7 November (`feature/week-3`; not approved yet, nothing
on `main`).

- **`main` and week 2 merged into week 3.** The note, customer and statement screens keep week 2's
  look with week 3's actions. All checks passed after the merge.
- **Payments and charges** page and filter like the other lists (D32, D33), with search by customer
  or receipt number and the look and skeletons of D34. "Cobros" joins the menu.
- **Charge concepts (D24):** interest, price adjustment, notarized contract, other; only an
  adjustment can lower the debt.
- **Receipts keep their balances (D27)** and a concept that can be written or is built from what the
  payment was applied to. Migration `0017_charge_concepts_and_receipt_balances`.
- **Notes and receipts print like the paper forms (D26)**, compared with the photos of 28 October:
  logo, boxes, six-digit numbers, amount in words, long date, signature blocks. The statement PDF
  gets the letterhead too; it still said AGROSOY.
- **Home:** total debt and debt older than 90 days, a technician's own portfolio for technicians.
- **Returns and transfers leave the note's actions** until they gather several deliveries (D25).
- **Walked through in the browser**, on a separate local database (`agrosoy_s3_demo`): the sample
  sheet reconciles to the cent (US$ 31,932.00, no differences), then note → debt, payment → receipt
  and statement, adjustment → lower debt.
- **Left for 9–13 November:** printed receipt numbers and number ranges (D28), returns from several
  deliveries (D25), opening balances and cut-off date (D29), the company settings page, Agrosoil's
  customer list and real data.
- **To confirm with Agrosoil:** the second mobile number. The details it sent say 72142142 and its
  printed forms say 76662583; the documents use the former.

## 2026-11-04

- **Staging is on its domain:** `https://agrosoil.market-ia.shop`, with `main` at `fde4ea1` or later
  and port 3100 closed. Recorded in `deploy/server-log.md`, with what could only be checked from
  outside. The certificate expires on 31 January 2027 and nothing renews it yet (`deploy/README.md`,
  B5). This site also answers unknown names on the shared nginx; left as it is, with the fix noted.
- **Week 3's state, reviewed:** the base is built on `feature/week-3` but not approved. Left to do:
  - merge `main` in (14 files conflict), page and filter payments and charges, and bring the new
    look and skeletons to the week's own screens;
  - charge concepts (D24), receipt balances (D27), printed receipt numbers and the system's range
    (D28), company profile and PDFs like the paper forms (D26), returns and transfers from several
    deliveries (D25), and opening balances, historical notes and payments with a cut-off date (D29).

## 2026-11-02

- **Filters apply as they change (D33)** in products, customers and notes: no "Buscar" button,
  the search box waits for a 350 ms pause, selects apply at once, Enter still searches. The price
  sheet keeps "Ver". Week 3's lists (payments, charges, statements) get the same when it merges.
- **Agrosoil's look (D34):** colors from the logo, a green sidebar with the logo and sections,
  a branded login and a home page with shortcuts and counts; tables, lists, badges, buttons and
  fields restyled for every screen. The products list shows presentations as tags with their price,
  one row per product. "Precios" joins the menu.
- **Loading skeletons** on every screen, shaped like its content (same cards, columns and form
  rows) from `shared/presentation/skeletons.tsx`, so nothing jumps when the data arrives. Header
  buttons still wait for permissions. The products page drops its "Precios" button (now in the menu).

## 2026-11-01

- **The client is Agrosoil**, not Agrosoil: renamed in every screen, page title, document and doc.
  Technical names stay (`agrosoy-web`, databases, containers, staging) until a planned change.
  Exchange-rate examples say 12.00, the current rate, instead of 6.96.
- **Corrections from the developer's review of week 2** (`feature/week-2`):
  - **Dates as dd/mm/aaaa** in campaigns and notes, typed or chosen in the calendar (D31).
  - **New presentations propose the next free code** (new product, "Otra presentación", adding
    one on a product); codes, amounts, quantities and rates select their whole value on tap.
  - **Products list shows prices:** one line per presentation with the general price of the
    current campaign; zone prices stay on the prices page.
  - **Importing the list again updates prices and names by code** and shows each change before
    saving (D23). The developer's test file had saved 7.90; the prices page showed the old value
    because the hidden screen kept it.
  - **Screens start clean** after leaving them, and filters show what the list applies (D31).
  - **Choosing a customer on a note fills who receives** with the customer's name, NIT/CI and
    "Titular", still editable.
- **Pagination (D32):** customers, notes, products and the change log in pages of 20; phones
  append the next page while scrolling. The notes list had a page size but no way to reach page 2.
- **Deployed to staging** (`main` at `8186f36`, by the developer) for the business owner's demo.

## 2026-10-31

- **Week 2 merged into `main`** (developer's approval), after `main` → `feature/week-2`; week 3
  received both. Week 2's last items stay on `feature/week-2` and reach `main` the same way.
- **Small screens:** from 768px the modules sit in a sidebar; below, the header's menu button
  opens them in a drawer. Tables become one card per row (customers, users, change log, imports,
  statements, products, campaigns, notes).
- **Week 2's additions from Agrosoil's answers are built** (`feature/week-2`):
  - **Codes per presentation (D23):** Agrosoil's numbers ("001"), padded to three digits and
    unique; an empty code takes the next free one. The product's own number is gone. Migration
    `0011_presentation_codes` numbers existing presentations in creation order.
  - **Pieces** ("u", a bag of 50 sheets), outside the liter and kilo totals.
  - **Inactive products and presentations:** deactivated and reactivated, never deleted; they
    leave new notes and price sheets. The product list filters by status and finds codes.
  - **Product list import:** Productos > "Importar lista" reads `PRODUCTOS.xlsx` into a preview
    (new, existing, conflicts, findings to review) and then into products with Agrosoil's codes and
    the chosen campaign's general prices. Again creates nothing new. Checked with the real list:
    78 presentations of 57 products; the 3 "OTROS" rows are charge concepts (week 3).
  - **Copy prices from the previous campaign** on the price sheet: fills only empty prices and
    saves nothing until "Guardar precios".
  - **Notes:** who hands the product over (any active user, the technician by default) and the
    optional carrier (company, vehicle, driver's CI). Migration `0012_note_carrier`.
- **Next:** the customer list import when Agrosoil sends it; week 3 receives these changes with
  its migrations renumbered after `0012`.
- **The zone of work is chosen from the zones** (the customers' zones; Agrosoil's technicians work
  in the same two). Migration `0006_user_work_zone` replaces the text column with a reference;
  deactivated zones stay on the technicians who had them and show as "(desactivada)".
- In development, a schema change can leave the hot-reloaded database client with stale column
  names (Drizzle's casing cache); restart `pnpm dev` after migrations.
- **Week 2 branch:** `main` merged in; the week's migrations are now `0007_campaigns` to
  `0010_delivery_notes`.
- **Week 3 branch:** week 2 merged in; the week's migrations are now
  `0011_note_confirmation_and_ledger` to `0014_sales_import`.

## 2026-10-30

- **Agrosoil's answers and documents mapped into the design** (decisions D23–D30, glossary, domain
  model, roadmap): photos of the paper note (one form and one number sequence for delivery, return
  and transfer) and of the cash receipt, the product list (`PRODUCTOS.xlsx`: 81 codes per
  container, prices per liter/kilo or container, "OTROS" codes that are charge concepts) and the
  weekly travel-expense spreadsheet. Agrosoil won't share its full sales spreadsheets and will enter
  its own opening debts, so manual opening data becomes the main way to go live (D29). Customers
  arrive next.
- Answered: shared note numbering (D19) and interest (D24). Still open: MP/SV and what closes a
  consignment.
- Branches: `main` stays week 1; week 2 and week 3 stay on their branches and receive `main`'s
  changes by merge (week 1 → week 2 → week 3).
- **Users get a position, CI and (technicians) a zone of work** (D26, D30): optional fields on
  create, a new edit page at `/users/[id]` (name, position, CI, zone; username and role stay as
  created), shown in the users list. Migration `0005_user_profile`. Customer import still waits
  for the list.
- **Week 2 branch:** `main` merged in. Zone renaming and deactivation now sit beside customer
  properties, receivers and deactivation; the price sheet and the note form list deactivated zones
  too (marked), since their customers still need prices. Migrations shared with `main` keep their
  numbers and the week's own follow them, because Drizzle skips any migration older than the last
  one a database applied.
- **Week 3 branch:** week 2 merged in (with `main`'s changes); only the docs needed hand merging:
  decisions now run D1–D30 in order, and the domain model notes that returns and transfers are
  still built against a single note until D25 is implemented. The week's own migrations follow
  week 2's.

## 2026-10-29

- **Staging deployment adapted to the real server** (0.7 part 2, files ready; not deployed yet).
  The VPS is borrowed and already runs a shared nginx + certbot, so Caddy is dropped (D14
  updated): `deploy/compose.yaml` publishes no ports, names its containers `agrosoy-<environment>`,
  joins the shared `server-network`, and keeps the database on an internal network.
  `deploy/nginx/` holds the HTTP-only and HTTPS files for `agrosoy.solution-services-tech.com` in
  the server's style. Until the domain is decided, staging is reached at
  `http://38.242.145.246:3100` through `deploy/compose.ip.yaml`, turned on from `.env` (phase A);
  phase B (DNS, certificate, HTTPS, closing the port) is ready and documented. All deployment
  docs moved to `deploy/README.md`, numbered steps with their check and undo.
- On the server, two unused old projects that published ports 3300 and 3400 were stopped
  (`docker compose down`, volumes and folders kept for now).
- Decided: staging stays reachable by IP and port for the whole of phase A (no opening and closing
  per demo), and its domain is `agrosoy.solution-services-tech.com`. nginx gets the HTTP-only file
  in phase A (step A6), so once the DNS record exists only the certificate and HTTPS remain. The
  record will be requested from the server's admin later.
- **Staging is up** at `http://38.242.145.246:3100` (steps A1–A4): image `main` at 0dccd17,
  migrations applied, health OK, first administrator created.
- **Phase A complete:** daily backup at 03:15 server time (first dump checked), and the shared
  nginx serves `agrosoy.solution-services-tech.com` over HTTP to the app (`nginx -t` passed,
  reloaded, answers with our login redirect). The temporary administrator password was changed.
- `deploy/server-log.md` records every change made on the server (removed, added, shared
  components touched, pending, how to undo).
- **Next:** ask the server's admin for the DNS record (message in `deploy/README.md`, B1), then
  certificate and HTTPS (B2–B5).

## 2026-10-27

- **Zones can be renamed and deactivated** (requested for the week 1 demo). Renaming fixes typos
  and every customer shows the new name; deactivating stops offering the zone for customers while
  the ones that have it keep it (also when edited), since week 2's reference prices depend on
  zones. Never deleted; reactivable. The zones page shows each zone's customer count; the customer
  search can still filter by a deactivated zone. Audited.
- The week 1 demo runs against its own local database (`agrosoy_s1` in `.env.local`), so the
  test data of weeks 2 and 3 (database `agrosoy`) doesn't show up.

## 2026-10-26 (week 3, branch `feature/week-3`)

Branched from `feature/week-2` (not merged into `main` yet). Everything planned for week 3 is
built, each part tested in integration tests and in the browser:

- **Ledger and confirmation (M5, M7):** append-only customer ledger (a trigger rejects UPDATE and
  DELETE); confirming a note gives the next number (row-locked counter, D19) or keeps a paper
  note's printed number and debits its total; voiding (`notes.void`) reverses it on the void date.
  Notes are confirmed without stock until inventory exists (D18).
- **Collections (M6):** payments in US$ or Bs with their rate, receipt numbers, applied to a note,
  a campaign or the oldest debt first, overpayments kept as credit (D20); cash notes are confirmed
  with their payment; charges; the day's exchange rate, prefilled in notes and payments
  (`payments.manage`, "Cobranzas").
- **Account statement (M7):** portfolio and customer statements from the ledger with the
  spreadsheet's columns, per-campaign totals and aging (FIFO, 30/60/90/+90 days); spreadsheet
  previews moved to `/statements/preview`.
- **PDFs (D21):** delivery notes, receipts and customer statements with `@react-pdf/renderer`,
  with a "Compartir" button for the phone's share sheet.
- **Returns and campaign transfers (M5):** against the lines of a confirmed delivery note, up to
  what is left of each line; returns credit the original price, transfers move the debt to the
  new campaign at the new price.
- **Migration of sales and payments (M12, D22):** imported notes keep the sheet's numbers; the
  summary's payments go in on a cut-off date; reconciliation per customer; undo. With the real
  `ventas.xlsx` the 15 customers reconcile exactly (US$ 31.932,00) once all its products exist.
- Tests: 200 (unit and integration). CI runs on the branch.

**Next:** week 4 — warehouses, lots, kardex, transfers and counts (M8): confirming a note will
also take stock (D18), and lots arrive in note lines. Before go-live: Agrosoil's answers on note
numbering, MP/SV/Agrosoil and interest; the staging server; campaign closing (M4).

**Known debt:** a few repositories run queries in parallel (`Promise.all`) on one transaction's
client, which `pg` warns will stop working in pg 9; sequence them when touching that code.

## 2026-10-26 (week 2, branch `feature/week-2`)

- **Everything planned for week 2 is built** (ahead of the 2–6 Nov schedule), on its own branch
  until it is reviewed and merged into `main`:
  - **M4 campaigns:** summer and winter, non-overlapping dates, the current one by today's date in
    Bolivia.
  - **M3 catalog:** products with line, presentations (container or per liter/kilo), reference
    prices per campaign and zone with a general fallback.
  - **M2 rest:** customer page, properties and authorized receivers (deactivated, never deleted),
    portfolio history when the technician changes, deactivation.
  - **Import into real records:** sheets turn into customers and products (re-running creates
    nothing new); tested with `ventas.xlsx` (15 customers, 4-energy and Fulvin).
  - **Delivery-note drafts (start of M5):** `sales` module, `/notes` list, form and detail. The
    campaign comes from the date; the customer fills technician and receiver; prices are suggested
    from the zone's sheet; bonus and sample lines are free; totals in US$, Bs, liters and kilos.
    Drafts can be edited or discarded; nothing touches debts or stock until confirmation (week 3).
    Permissions `notes.view` (every role) and `notes.manage` (administration, management,
    technicians). Tested in the browser: create, edit (10 → 12 units, US$ 625 → 750) and the
    audit entries.
  - Fixed on the way: the change log named the property or receiver instead of the customer.
- **Next (week 3):** confirm notes with numbering and PDF, collections and exchange rates, the
  account statement from real records, and migrating sales and payments with reconciliation.
- **Week 2 starts on branch `feature/week-2`** (developer's request); `main` stays as the week 1
  demo version. CI now checks every branch and publishes the image only from `main`.
- **M1 completed:** editable permission matrix (`/users/permissions`, stored as differences from
  the defaults, administration fixed, only changed roles saved and audited) and the audit-log
  viewer (`/audit`, newest first, with the user and the name of what changed). `Actor` now carries
  its effective permissions; `audit_log.entity_id` became text so settings (roles) can be audited.
  Tested in the browser: granting "Importar planillas" to technicians shows the menu entry to them
  on their next request.
- **Week 1 status:** everything planned is done except the staging server (postponed). Next, by the
  roadmap: week 2 (M2 rest, M3 products and prices, M4 campaigns, import into real customers and
  products, delivery-note draft).
- **Spreadsheet import and statement preview (week 1):** import page for technicians' workbooks
  (`migration` module: header-based sheet reader, recomputed totals, findings in Spanish), and
  account statements by customer and per technician sheet (`receivables` view components meant to
  be reused by M7), with print/PDF from the browser. Verified with the real `ventas.xlsx`: 48 lines,
  15 customers, US$ 34.238,89 sold, US$ 2.306,89 collected, US$ 31.932,00 owed (6,7 % collected;
  the sheet's own formula says 32.318,89 because it skips two rows), 35 findings.
- Contract signed; the schedule in the roadmap holds (week 1: 26–30 October). The staging server
  (0.7 part 2) is postponed at the developer's request; work continues with the spreadsheet import
  and the account-statement preview.

## 2026-10-25

- **0.9 · Customers (M2, first part), the reference module:** register and edit customers with an
  automatic code, NIT/CI, phone, zone, technician and exchange-rate agreement; zones page; search
  by name, code or NIT/CI with a zone filter and pagination; technicians see their portfolio first
  and have read-only access. Tested in the browser as administrator and as technician. Fixed on
  the way: customers without a technician sorted before the technician's own (NULL ordering).
  **Next in M2 (week 2):** properties, authorized receivers, portfolio history, deactivation.
- **Next steps:** 0.7 part 2 (staging on the VPS, needs access), the account-statement preview
  with spreadsheet data, and the rest of M1 (editable permissions, audit-log viewer).
- **0.8 · Authentication and users (M1, first part):** Better Auth with username sign-in, login page,
  sign-out, `requireActor()` on every loader and action, proxy redirect without a session cookie,
  navigation filtered by permission, users page (create with a temporary password, reset password,
  deactivate and reactivate), forced password change at first sign-in, `pnpm users:first-admin`.
  Tested end to end in the browser and inside the Docker image. Fixed on the way: a repeated
  username was reported as a repeated email; after changing a password the re-render used the old
  Cookie header and Better Auth cleared the new session (now read from `cookies()`); `next build`
  failed without secrets; dev logs printed action arguments, including passwords (disabled).
  **Still in M1:** editable permission matrix and the audit-log viewer.
- **0.7 · Deployment, part 1 (no server needed):** standalone Docker image that runs migrations
  and then the server, `GET /api/health`, `deploy/` (compose per environment, `.env.example`,
  Caddy example, `backup.sh` with 30-day rotation and optional off-server copy), CI job that
  publishes the image to GHCR, and `docs/deployment.md`. Verified locally: migrations on start,
  health 200 with the database up and 503 with it down, backup dump readable by `pg_restore`.
  **Part 2 (pending, needs VPS access):** steps 1–7 of "First-time server setup".
- **0.6 · Shared kernel** (`src/shared/domain`): `Money` (bigint cents), `Quantity` (bigint
  thousandths, `times(price)` for line totals), `ExchangeRate` (4 decimals, BOB↔USD), half-up
  rounding, `DomainError` codes, text cleaning and the name comparison key; `validateInput` in
  `shared/application`. 37 unit tests.
- **Workflow change:** no branches or pull requests; steps are committed to `main` in order.
- **0.5 · Database:** Postgres 16 in Docker (`pnpm db:up`, port 5434) with an `agrosoy_test`
  database, Drizzle client with `getDb()` and `withTransaction()`, SQL migrations in `drizzle/`
  applied by `pnpm db:migrate`, the `audit_log` table and its `AuditTrail` port, and the
  integration-test harness (`*.int.test.ts`, tables emptied before each test). CI runs them
  against a Postgres service.
- **0.4 · Tooling**: stricter TypeScript (`noUncheckedIndexedAccess`), ESLint
  layer rules, Prettier with the Tailwind plugin, Vitest (unit project), `pnpm check`, GitHub Actions CI,
  `.githooks/commit-msg` that strips AI co-author lines, `CLAUDE.md` with the working rules.
- **0.3 · Design docs**: glossary, domain model, decisions D1–D16 and
  the roadmap. Open questions for Agrosoil are listed at the end of the glossary.
- **0.2 · Repository:** Next.js 16.4 base in the private repo `SOLUTI0N-TECH/agrosoy-web`.
- **0.1 · Clean start:** the first exploratory scaffold was removed; it is rebuilt step by step
  following the roadmap.
