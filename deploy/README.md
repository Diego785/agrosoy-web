# Deployment

How the app runs on the server SolutionTech uses (docs/decisions.md, D14). The server is borrowed
and hosts other projects, so everything here stays inside our own folder, our own port and,
later, our own nginx file.

Two environments, same image: **staging** for the weekly demos and, later, **production** for
real use. "staging" is only the environment's internal name (folder and containers); people never
see it in the address.

Two phases:

- **Phase A, now:** staging reached by IP and port, `http://38.242.145.246:3100`. No domain, no
  DNS, nothing to ask the server's admin.
- **Phase B, at the end:** a domain with HTTPS through the server's shared nginx. Its files are
  ready in `nginx/`; it only needs the final domain name and its DNS record.

## Files

| File                               | What it is                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `compose.yaml`                     | App + Postgres. Publishes no ports; joins the shared `server-network` for nginx |
| `compose.ip.yaml`                  | Phase A only: publishes the app on the public port. Turned on from `.env`       |
| `.env.example`                     | Every setting, with phase A and phase B values                                  |
| `backup.sh`                        | Daily database dump, 30 days kept, optional off-server copy                     |
| `nginx/agrosoy-staging.http.conf`  | Phase B, step 1: HTTP only, serves the certificate challenge                    |
| `nginx/agrosoy-staging.https.conf` | Phase B, step 4: HTTPS, HTTP redirects to it                                    |

## How it fits together

```
GitHub (push to main) ──CI──▶ check + build ──▶ image ghcr.io/soluti0n-tech/agrosoy-web:<sha> and :main
                                                     │
Server  /home/apps/www/solution/agrosoy/staging      │
        ├─ compose.yaml + compose.ip.yaml            │
        ├─ .env          docker compose pull ◀───────┘
        ├─ backup.sh     agrosoy-staging (app) ──internal network──▶ agrosoy-staging-db (Postgres 16, volume)
        └─ backups/          ▲                ▲
                             │ phase A        │ phase B: server-network
                    http://IP:3100            │
        /home/apps/nginx-certbot-docker   shared nginx, ports 80/443
        └─ conf/agrosoy-staging.conf      https://<domain> ──▶ http://agrosoy-staging:3000
```

- The container applies pending migrations, then starts the server (`Dockerfile`, last line).
- `GET /api/health` answers 200 when the database responds and 503 when it doesn't; Docker
  uses it to mark the container healthy.
- The database is only on the project's internal network: never reachable from outside.
- Each environment has its own folder, containers (`agrosoy-<environment>`), database volume,
  password and backups.

## Server rules

- Commands run in our SSH session, one step at a time, checking the output before the next.
- Ours: `/home/apps/www/solution/agrosoy/`, port 3100 and, in phase B,
  `conf/agrosoy-*.conf` in the nginx folder. Nothing else.
- nginx: `docker exec nginx nginx -t`, and only if it passes, `docker exec nginx nginx -s reload`.
  **Never restart it**: a broken config would take down every site on the server.
- No `prune`, no `docker compose down -v`, nothing in other projects' folders.

## Phase A · Staging by IP and port

Each step says how to check it and how to undo it.

### A1 · Registry access (once per server)

The image is private. Create a GitHub **classic** token with only the `read:packages` scope and an
expiry date (GitHub → Settings → Developer settings → Personal access tokens); if the
SOLUTI0N-TECH organization asks to approve it, approve it. On the server:

```bash
docker login ghcr.io -u <github-user>      # password: paste the token
```

- **Check:** `Login Succeeded`.
- **Undo:** `docker logout ghcr.io`.
- When the token expires, `pull` fails with `denied`: create a new one and log in again.

### A2 · Folder and files

```bash
mkdir -p /home/apps/www/solution/agrosoy/staging/backups
```

From the repository on your computer:

```bash
scp deploy/compose.yaml deploy/compose.ip.yaml deploy/backup.sh root@38.242.145.246:/home/apps/www/solution/agrosoy/staging/
```

On the server, create `.env` from `.env.example`:

```bash
cd /home/apps/www/solution/agrosoy/staging
openssl rand -hex 24          # → POSTGRES_PASSWORD
openssl rand -base64 32       # → BETTER_AUTH_SECRET
nano .env                     # paste .env.example, fill in both values
chmod 600 .env && chmod +x backup.sh
docker compose config -q && echo ok
ss -tln | grep ':3100 ' || echo "3100 free"
```

- **Check:** `ok` and `3100 free`. If 3100 is taken, pick another free port and change it in both
  `PUBLIC_PORT` and `BETTER_AUTH_URL`.
- **Undo:** `rm -r /home/apps/www/solution/agrosoy`.

### A3 · Start

```bash
docker compose pull
docker compose up -d
docker compose ps                  # db "healthy", app "Up … (healthy)" after ~30 s; app shows 0.0.0.0:3100->3000
docker compose logs --tail 30 app
curl -s http://127.0.0.1:3100/api/health
```

- **Check:** the health answer from the server itself, then open `http://38.242.145.246:3100`
  in a browser. If the server answers locally but not from outside, the provider's firewall blocks
  the port.
- **Undo:** `docker compose down` (keeps the database volume).

### A4 · First administrator

```bash
docker compose exec app node create-first-admin.mjs --name "…" --username …
```

It prints a temporary password, to be changed at the first sign-in.

### A5 · Backups

```bash
./backup.sh && ls -lh backups/
crontab -e
# 15 3 * * * cd /home/apps/www/solution/agrosoy/staging && ./backup.sh >> backups/backup.log 2>&1
```

For the off-server copy, configure `rclone config` and set `RCLONE_REMOTE`.

### While in phase A

- It's plain HTTP: passwords travel unencrypted. Demo data and temporary passwords only; nothing
  real until phase B.
- Sign-in only works from the address in `BETTER_AUTH_URL`; opening the app by another address
  (e.g. without the port) fails at sign-in.

## Phase B · Domain and HTTPS

To do at the end, when the domain is decided.

### B0 · Choose the domain

The nginx files use `agrosoy.solution-services-tech.com`. If the final name differs, replace it in
both files before copying them:

```bash
sed -i 's/agrosoy\.solution-services-tech\.com/<final-domain>/g' deploy/nginx/*.conf
```

If production will later take that same name, use a different one for staging
(e.g. `demo-agrosoy.solution-services-tech.com`).

### B1 · nginx, HTTP only

Copy `nginx/agrosoy-staging.http.conf` to the server as
`/home/apps/nginx-certbot-docker/conf/agrosoy-staging.conf`, then:

```bash
docker exec nginx curl -s http://agrosoy-staging:3000/api/health     # nginx reaches the app
docker exec nginx nginx -t                                           # must pass…
docker exec nginx nginx -s reload                                    # …before this
curl -sI -H "Host: <domain>" http://127.0.0.1/
```

- **Check:** the last `curl` answers from our app, not another site. It's harmless before DNS exists.
- **Undo:** remove the file, `nginx -t`, reload.

### B2 · DNS

An A record `<domain>` → `38.242.145.246`, created by whoever manages the domain (for
`solution-services-tech.com`, the server's admin).

- **Check:** `nslookup <domain> 1.1.1.1` returns the server's IP.
- **Undo:** remove the record.

### B3 · Certificate

From `/home/apps/nginx-certbot-docker`, rehearsal first:

```bash
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d <domain> --dry-run
docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot/ -d <domain>
```

- **Check:** `Successfully received certificate`.
- **Undo:** `docker compose run --rm certbot delete --cert-name <domain>` (after removing the
  HTTPS file that uses it).

### B4 · nginx, HTTPS

```bash
cp conf/agrosoy-staging.conf ~/agrosoy-staging.http.conf.bak     # outside conf/
# replace conf/agrosoy-staging.conf with nginx/agrosoy-staging.https.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

- **Check:** `https://<domain>` opens with the padlock; `http://` redirects to it.
- **Undo:** copy the backup back, test, reload.

### B5 · Switch the app to the domain and close the port

In `.env`: remove the `COMPOSE_FILE` and `PUBLIC_PORT` lines, and set
`BETTER_AUTH_URL=https://<domain>`. Then:

```bash
docker compose up -d                    # recreates the app without the public port
docker compose ps                       # no 0.0.0.0:3100 anymore
```

- **Check:** sign-in works at `https://<domain>`; `http://38.242.145.246:3100` no longer answers.
- **Undo:** put the lines back, `docker compose up -d`.

### B6 · Renewal

Let's Encrypt certificates last 90 days and the server has no scheduled renewal. Agree with the
server's admin on one (`docker compose run --rm certbot renew` plus `nginx -s reload`), since it
renews every site on the server.

## Production (later)

Same steps in `/home/apps/www/solution/agrosoy/production` with `ENVIRONMENT=production`, its own
secrets, its own domain and nginx files named `agrosoy-production.*`, pointing to
`agrosoy-production:3000`. It goes straight to phase B: real data never travels over plain HTTP.

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
