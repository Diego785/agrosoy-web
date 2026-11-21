# Agrosoil Web

Sales, accounts receivable and warehouse inventory system for Agrosoil (Bolivia). One Next.js
16 application organized as a modular monolith. Built for SolutionTech.

@AGENTS.md

## Read first

- `docs/progress.md`: where the last session stopped.
- `docs/domain-model.md`: business rules for notes, collections, the ledger and inventory.
- `docs/glossary.md`: the English name for every Spanish business term. Use it; don't invent synonyms.
- `docs/decisions.md`: why things are built this way (D1–D44). Add a decision instead of quietly deviating.

## Working method

- Follow the roadmap steps in order. Each week's work goes on a `feature/week-N` branch; `main`
  keeps the version shown in the last demo and receives the branch once the developer approves it.
- A change goes on the branch of the week it belongs to and reaches the later weeks by merging
  forward: `main` → `feature/week-2` → `feature/week-3`. `main` holds what the developer has
  approved: weeks 1 and 2, and week 3 as far as it went on 7 November. Week 3's remaining items go
  on `feature/week-3` and reach `main` the same way. Only approved work merges into `main`; nothing
  else merges backwards.
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

Stop a server you started by the PID listening on its port, never by process name. Don't run
`next build` while `next dev` is running: the shared `.next` folder makes the dev page reload in a loop.

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

- Work on the current `feature/week-N` branch; CI runs on every push to any branch and must stay
  green. Only `main` publishes the Docker image.
- Conventional commits (`feat(sales): …`, `fix(inventory): …`, `docs: …`, `chore: …`) with a body
  listing the main changes. Stage files by path, never `git add -A`.
- **Never add `Co-Authored-By` or "Generated with" lines.** `.githooks/commit-msg` strips them anyway.
