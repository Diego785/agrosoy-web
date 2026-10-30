# Progress

What has been done, newest first. Each working session adds an entry, so the next one can pick
up without re-reading the whole history.

## 2026-10-30

- **Agrosoy's answers and documents mapped into the design** (decisions D23–D30, glossary, domain
  model, roadmap): photos of the paper note (one form and one number sequence for delivery, return
  and transfer) and of the cash receipt, the product list (`PRODUCTOS.xlsx`: 81 codes per
  container, prices per liter/kilo or container, "OTROS" codes that are charge concepts) and the
  weekly travel-expense spreadsheet. Agrosoy won't share its full sales spreadsheets and will enter
  its own opening debts, so manual opening data becomes the main way to go live (D29). Customers
  arrive next.
- Answered: shared note numbering (D19) and interest (D24). Still open: MP/SV and what closes a
  consignment.
- Branches: `main` stays week 1; week 2 and week 3 stay on their branches and receive `main`'s
  changes by merge (week 1 → week 2 → week 3).
- **Week 2 branch:** `main` merged in. Zone renaming and deactivation now sit beside customer
  properties, receivers and deactivation; the price sheet and the note form list deactivated zones
  too (marked), since their customers still need prices.

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
  the roadmap. Open questions for Agrosoy are listed at the end of the glossary.
- **0.2 · Repository:** Next.js 16.4 base in the private repo `SOLUTI0N-TECH/agrosoy-web`.
- **0.1 · Clean start:** the first exploratory scaffold was removed; it is rebuilt step by step
  following the roadmap.
