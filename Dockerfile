# syntax=docker/dockerfile:1

# Production image: Next.js standalone server plus a bundled migration script (docs/decisions.md, D14).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: the only install script sets up git hooks, which an image has no use for.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# Migrations run with plain Node in the final image, so bundle the script with its dependencies.
RUN pnpm exec esbuild scripts/migrate.ts --bundle --platform=node --format=esm --target=node22 \
    --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
    --outfile=dist/migrate.mjs
# The first-admin script imports server modules, hence the react-server condition.
RUN pnpm exec esbuild scripts/create-first-admin.ts --bundle --platform=node --format=esm --target=node22 \
    --conditions=react-server --tsconfig=tsconfig.json \
    --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
    --outfile=dist/create-first-admin.mjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=America/La_Paz
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/dist/migrate.mjs ./migrate.mjs
COPY --from=build --chown=app:app /app/dist/create-first-admin.mjs ./create-first-admin.mjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
# Pending migrations are applied before the server accepts traffic.
CMD ["sh", "-c", "node migrate.mjs && exec node server.js"]
