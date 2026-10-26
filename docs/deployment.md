# Deployment

How the app runs on the SolutionTech VPS (docs/decisions.md, D14). Two environments, same
image: **staging** for the weekly demos and **production** on Agrosoy's subdomain.

## How it fits together

```
GitHub (push to main) ──CI──▶ check + build ──▶ image ghcr.io/soluti0n-tech/agrosoy-web:<sha> and :main
                                                     │
VPS  /srv/agrosoy/staging     docker compose pull ◀──┘
     ├─ compose.yaml          app  (127.0.0.1:3100) ──▶ db (Postgres 16, volume)
     ├─ .env                  Caddy: https://staging… ──▶ 127.0.0.1:3100
     └─ backup.sh             cron 03:15 ──▶ backups/ (30 days) ──▶ off-server copy
     /srv/agrosoy/production  same layout, APP_PORT 3200
```

- The container applies pending migrations, then starts the server (`Dockerfile`, last line).
- `GET /api/health` answers 200 when the database responds and 503 when it doesn't; Docker
  uses it to mark the container healthy.
- Each environment has its own database volume, password and backups.

## First-time server setup (done together, step 0.7)

1. **Check the server:** Docker with the compose plugin, free ports 3100 and 3200, and whether a
   reverse proxy (Caddy or nginx) already serves other sites on ports 80/443.
2. **Folders:** `/srv/agrosoy/staging` (and later `/srv/agrosoy/production`) with
   `deploy/compose.yaml`, `deploy/backup.sh` and a `.env` made from `deploy/.env.example`.
3. **Registry access:** a GitHub token with `read:packages`, then
   `docker login ghcr.io -u <github-user>` on the server (the package is private).
4. **Start:** `docker compose pull && docker compose up -d`, then
   `curl -s http://127.0.0.1:3100/api/health`.
5. **HTTPS:** add the site to the reverse proxy (`deploy/Caddyfile.example`) and point a DNS
   record at the server.
6. **Backups:** make `backup.sh` executable, add the cron line from its header, configure an
   off-server destination with `rclone config` and set `RCLONE_REMOTE`.
7. **Automatic deploys** (optional): a deploy key and SSH secrets so CI runs step 4 after each
   push; until then, run it by hand after the image job finishes.

## Everyday operations

All commands run in the environment's folder, e.g. `cd /srv/agrosoy/staging`.

| Task                         | Command                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Deploy the latest `main`     | `docker compose pull && docker compose up -d`                                                                      |
| Pin or roll back to a commit | set `IMAGE_TAG=<sha>` in `.env`, then the deploy command                                                           |
| Is it up?                    | `docker compose ps` and `curl -s http://127.0.0.1:<APP_PORT>/api/health`                                           |
| Logs                         | `docker compose logs -f app`                                                                                       |
| Backup now                   | `./backup.sh`                                                                                                      |
| Restore a backup             | `docker compose exec -T db pg_restore -U agrosoy -d agrosoy --clean --if-exists < backups/agrosoy-YYYY-MM-DD.dump` |

A rollback only changes the code: migrations are never undone automatically. If a release
included a migration, restore the backup taken before it.

## Local smoke test of the image

```bash
corepack pnpm db:up
docker build -t agrosoy-web:local .
docker run --rm --network agrosoy_default -p 3008:3000 \
  -e DATABASE_URL=postgres://agrosoy:agrosoy@db:5432/agrosoy agrosoy-web:local
curl -s http://localhost:3008/api/health
```
