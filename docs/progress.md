# Progress

What has been done, newest first. Each working session adds an entry, so the next one can pick
up without re-reading the whole history.

## 2026-10-25

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
