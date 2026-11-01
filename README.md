# Agrosoil Web

Sales, accounts receivable and warehouse inventory system for Agrosoil, an agricultural
inputs distributor in Bolivia. Built by SolutionTech.

The user interface is in Spanish (Bolivia); code, docs and commits are in English.

## Requirements

- Node.js 22 or later
- pnpm 10.18 through Corepack (`corepack pnpm …`; pnpm does not need to be installed globally)

## Getting started

```bash
corepack pnpm install
cp .env.example .env.local
corepack pnpm db:up      # Postgres 16 in Docker on port 5434
corepack pnpm db:migrate
corepack pnpm users:first-admin --name "Your Name" --username you   # prints a temporary password
corepack pnpm dev        # http://localhost:3000
```

## Scripts

| Command               | What it does                |
| --------------------- | --------------------------- |
| `corepack pnpm dev`   | Development server          |
| `corepack pnpm build` | Production build            |
| `corepack pnpm start` | Serves the production build |
| `corepack pnpm lint`  | ESLint                      |
