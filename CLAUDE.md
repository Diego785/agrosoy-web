# Agrosoy Web

Sales, accounts receivable and warehouse inventory system for Agrosoy (Bolivia). One Next.js
16 application organized as a modular monolith. Built for SolutionTech.

@AGENTS.md

## Read first

- `docs/progress.md`: where the last session stopped.
- `docs/domain-model.md`: business rules for notes, collections, the ledger and inventory.
- `docs/glossary.md`: the English name for every Spanish business term. Use it; don't invent synonyms.
- `docs/decisions.md`: why things are built this way (D1–D16). Add a decision instead of quietly deviating.

## Working method

- One task per session: propose a short plan (files, tables, rules, tests), wait for the
  developer's approval, then implement on a branch and open a pull request.
- Don't start the next roadmap step without approval.
- End every session by adding an entry to `docs/progress.md`.

## Commands (Windows: pnpm comes through Corepack)

```bash
corepack pnpm install        # also enables .githooks
corepack pnpm dev            # http://localhost:3000
corepack pnpm check          # typecheck + lint + format check + all tests (what CI runs)
corepack pnpm test           # unit tests only
corepack pnpm format         # Prettier
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

- Branches `feature/…`, `fix/…`, `docs/…`, `chore/…`; pull request into `main`; CI must pass.
- Conventional commits (`feat(sales): …`, `fix(inventory): …`, `docs: …`, `chore: …`) with a body
  listing the main changes. Stage files by path, never `git add -A`.
- **Never add `Co-Authored-By` or "Generated with" lines.** `.githooks/commit-msg` strips them anyway.
