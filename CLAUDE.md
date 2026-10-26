# Agrosoy Web

Sales, accounts receivable and warehouse inventory system for Agrosoy (Bolivia). One Next.js
16 application organized as a modular monolith. Built for SolutionTech.

@AGENTS.md

## Read first

- `docs/progress.md`: where the last session stopped.
- `docs/domain-model.md`: business rules for notes, collections, the ledger and inventory.
- `docs/glossary.md`: the English name for every Spanish business term. Use it; don't invent synonyms.
- `docs/decisions.md`: why things are built this way (D1–D17). Add a decision instead of quietly deviating.

## Working method

- Follow the roadmap steps in order, committing straight to `main` (no branches or pull requests).
- Each commit leaves `main` working: `corepack pnpm check` passes before committing.
- End every session by adding an entry to `docs/progress.md`.

## Commands (Windows: pnpm comes through Corepack)

```bash
corepack pnpm install        # also enables .githooks
corepack pnpm dev            # http://localhost:3000
corepack pnpm check          # typecheck + lint + format check + all tests (what CI runs)
corepack pnpm test           # unit tests only
corepack pnpm format         # Prettier
corepack pnpm test:integration  # use cases against the agrosoy_test database
corepack pnpm db:up          # local Postgres 16 in Docker (port 5434)
corepack pnpm db:generate    # SQL migration from schema changes; review it, then commit it
corepack pnpm db:migrate     # apply pending migrations
corepack pnpm users:first-admin --name "…" --username …  # first administrator of an empty database
```

Stop a server you started by the PID listening on its port, never by process name.

## Language

- Code, identifiers, comments, docs and commit messages: **English**.
- User-facing text: **Spanish (Bolivia)**, written in the components (single locale, D11).
- Comments explain why, not what; add them only where the reason isn't obvious.

## Architecture rules

- Modules live in `src/modules/<module>/{domain,application,infrastructure,presentation}`;
  shared code in `src/shared/` with the same layers. Routes in `src/app/` stay thin.
- `domain` is pure TypeScript. `application` holds use cases, Zod input schemas, ports and
  permissions. ESLint rejects imports that break this (D2).
- Data changes only through use cases. Every use case checks the actor's role and validates its
  input, even if the form already did (D3).
- Money, quantities and exchange rates use the `Money`, `Quantity` and `ExchangeRate` value
  objects, never `number` arithmetic on floats (D5).
- Ledger entries and stock movements are append-only; voiding writes reversals (D6).
- Anything reading the session or the database renders inside `<Suspense>`; never `"use cache"`
  balances, stock or statements (D9).
- Next.js 16 differs from older versions; check `node_modules/next/dist/docs/` before using an API.

## Git

- Work directly on `main`; CI runs on every push and must stay green.
- Conventional commits (`feat(sales): …`, `fix(inventory): …`, `docs: …`, `chore: …`) with a body
  listing the main changes. Stage files by path, never `git add -A`.
- **Never add `Co-Authored-By` or "Generated with" lines.** `.githooks/commit-msg` strips them anyway.
