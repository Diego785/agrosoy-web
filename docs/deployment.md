# Deployment

How the app runs on the server SolutionTech uses (docs/decisions.md, D14). The server is borrowed
and hosts other projects, so everything here stays inside our own folder and our own nginx file.
Two environments, same image: **staging** for the weekly demos and, later, **production**.

## How it fits together

```
GitHub (push to main) ──CI──▶ check + build ──▶ image ghcr.io/soluti0n-tech/agrosoy-web:<sha> and :main
                                                     │
Server  /home/apps/www/solution/agrosoy/staging      │
        ├─ compose.yaml      docker compose pull ◀───┘
        ├─ .env              agrosoy-staging (app) ──internal network──▶ agrosoy-staging-db (Postgres 16, volume)
        ├─ backup.sh                 ▲
        └─ backups/                  │ server-network (shared Docker network)
                                     │
        /home/apps/nginx-certbot-docker   shared nginx, the only container on ports 80/443
        └─ conf/agrosoy-staging.conf      agrosoy.solution-services-tech.com ──▶ http://agrosoy-staging:3000
```

- **No published ports.** nginx reaches the app by container name over `server-network`; the
  database is only on the project's internal network.
- The container applies pending migrations, then starts the server (`Dockerfile`, last line).
- `GET /api/health` answers 200 when the database responds and 503 when it doesn't; Docker
  uses it to mark the container healthy.
- Each environment has its own folder, containers (`agrosoy-<environment>`), database volume,
  password and backups.

## Server rules

- Commands run in our SSH session, one step at a time, checking the output before the next.
- Only `/home/apps/www/solution/agrosoy/` and `conf/agrosoy-*.conf` in the nginx folder are ours.
- nginx: `docker exec nginx nginx -t`, and only if it passes, `docker exec nginx nginx -s reload`.
  **Never restart it**: a broken config would take down every site on the server.
- No `prune`, no `docker compose down -v`, nothing in other projects' folders.

## First-time setup of staging

Each step says how to check it and how to undo it.

### 1 · Registry access (once per server)

The image is private. Create a GitHub **classic** token with only the `read:packages` scope and an
expiry date (GitHub → Settings → Developer settings → Personal access tokens). On the server:

```bash
docker login ghcr.io -u <github-user>      # password: paste the token
```

- **Check:** `Login Succeeded`.
- **Undo:** `docker logout ghcr.io`.

### 2 · Folder and files

```bash
mkdir -p /home/apps/www/solution/agrosoy/staging/backups
```

From the repository on your computer:

```bash
scp deploy/compose.yaml deploy/backup.sh root@<server-ip>:/home/apps/www/solution/agrosoy/staging/
```

On the server, create `.env` from `deploy/.env.example`:

```bash
cd /home/apps/www/solution/agrosoy/staging
openssl rand -hex 24          # → POSTGRES_PASSWORD
openssl rand -base64 32       # → BETTER_AUTH_SECRET
nano .env                     # paste .env.example, fill in both values
chmod 600 .env && chmod +x backup.sh
docker compose config -q && echo ok
```

- **Check:** `ok`. `BETTER_AUTH_URL` stays `http://localhost:3100` until the domain exists (step 5).
- **Undo:** `rm -r /home/apps/www/solution/agrosoy`.

### 3 · Start

```bash
docker compose pull
docker compose up -d
docker compose ps                  # db "healthy", app "Up … (healthy)" after ~30 s
docker compose logs --tail 30 app
docker exec nginx curl -s http://agrosoy-staging:3000/api/health
```

- **Check:** the last command prints the health answer: nginx can reach the app by name.
- **Undo:** `docker compose down` (keeps the database volume).

### 4 · First administrator

```bash
docker compose exec app node create-first-admin.mjs --name "…" --username …
```

It prints a temporary password, to be changed at the first sign-in.

### 5 · See it without the domain (SSH tunnel)

On the server, the app's address on the shared network:

```bash
docker inspect agrosoy-staging --format '{{(index .NetworkSettings.Networks "server-network").IPAddress}}'
```

On your computer (keep the terminal open while using it):

```bash
ssh -N -L 3100:<that-ip>:3000 root@<server-ip>
```

Open `http://localhost:3100`. Sign-in works because `BETTER_AUTH_URL` is that same address. The
IP can change when the container is recreated: repeat the `inspect` if the tunnel stops working.

### 6 · Domain (when DNS is requested)

1. **nginx phase 1:** copy `deploy/nginx/agrosoy-staging.http.conf` to
   `/home/apps/nginx-certbot-docker/conf/agrosoy-staging.conf`, then
   `docker exec nginx nginx -t` → only if it passes → `docker exec nginx nginx -s reload`.
   Check: `curl -sI -H "Host: agrosoy.solution-services-tech.com" http://127.0.0.1/` answers from
   the app. Undo: remove the file, test, reload.
2. **DNS:** A record `agrosoy.solution-services-tech.com` → the server's IP, by whoever manages
   the domain. Check: `nslookup agrosoy.solution-services-tech.com 1.1.1.1`.
3. **Certificate**, from `/home/apps/nginx-certbot-docker`:

   ```bash
   docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d agrosoy.solution-services-tech.com --dry-run
   docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d agrosoy.solution-services-tech.com
   ```

4. **nginx phase 2:** keep a copy of phase 1 outside `conf/`, replace the file with
   `deploy/nginx/agrosoy-staging.https.conf`, test, reload.
5. **App URL:** in `.env`, `BETTER_AUTH_URL=https://agrosoy.solution-services-tech.com`, then
   `docker compose up -d app` (`restart` doesn't re-read `.env`).
6. **Renewal:** the server has no scheduled certificate renewal; agree with the server's admin on
   one (`docker compose run --rm certbot renew` plus a reload), since it renews every site.

### 7 · Backups

```bash
crontab -e
# 15 3 * * * cd /home/apps/www/solution/agrosoy/staging && ./backup.sh >> backups/backup.log 2>&1
```

Run `./backup.sh` once by hand and check `ls -lh backups/`. For the off-server copy, configure
`rclone config` and set `RCLONE_REMOTE`.

## Everyday operations

All commands run in the environment's folder: `cd /home/apps/www/solution/agrosoy/staging`.

| Task                         | Command                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Deploy the latest `main`     | `./backup.sh && docker compose pull && docker compose up -d`                                                       |
| Pin or roll back to a commit | set `IMAGE_TAG=<sha>` in `.env`, then `docker compose up -d`                                                       |
| Is it up?                    | `docker compose ps` and `docker exec nginx curl -s http://agrosoy-staging:3000/api/health`                         |
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
