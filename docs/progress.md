# Progress

What has been done, newest first. Each working session adds an entry, so the next one can pick
up without re-reading the whole history.

## 2026-10-26

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
