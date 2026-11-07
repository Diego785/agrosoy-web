# Server log

Record of every change made on the shared server: what was there, what was removed, what was
added, what shared components were touched, and how to undo each change. Newest entry first.
How to operate the deployment itself is in [README.md](README.md).

## Server

|                |                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Host           | `vmi2754770`, public IP `38.242.145.246`                                                                                        |
| System         | Ubuntu 22.04.5 LTS, kernel 5.15, 23 GB RAM, 388 GB disk (15 % used)                                                             |
| Docker         | Engine 28.3.3, Compose v2.39.1                                                                                                  |
| Clock          | Server time is CET (UTC+1); container logs are in UTC                                                                           |
| Projects       | `/home/apps/www/<group>/<project>`, one compose project per folder                                                              |
| Reverse proxy  | Container `nginx` (`nginx:latest`), compose project `/home/apps/nginx-certbot-docker`, the only container on ports 80/443       |
| Proxy config   | `/home/apps/nginx-certbot-docker/conf/*.conf` → `/etc/nginx/conf.d` (one file per site)                                         |
| Certificates   | certbot webroot: `certbot/www` → `/var/www/certbot`; `certbot/conf` → `/etc/nginx/ssl` in nginx (`/etc/letsencrypt` in certbot) |
| Shared network | `server-network` (external); nginx reaches apps by container name                                                               |

---

## 2026-11-02/03 · Staging moved to its domain, with HTTPS

Phase B of [README.md](README.md), with the domain `agrosoil.market-ia.shop` instead of the one
planned earlier. The app's image was updated in the same session.

### Summary

| Type                       | What                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Added                      | Domain `agrosoil.market-ia.shop`: alias (CNAME) of `market-ia.shop`, which points to this server. The DNS records live outside the server                              |
| Added to shared components | Let's Encrypt certificate `agrosoil.market-ia.shop` in the proxy's `certbot/conf` (`live/`, `archive/`, `renewal/`)                                                    |
| Changed, shared components | `conf/agrosoy-staging.conf`: reloaded over HTTP with the new name, then replaced with `nginx/agrosoy-staging.https.conf`. nginx reloaded, `nginx -t` first. No restart |
| Changed, our folder        | `.env`: `COMPOSE_FILE` and `PUBLIC_PORT` removed, `BETTER_AUTH_URL=https://agrosoil.market-ia.shop`. Image `main` updated. Public port 3100 closed                     |
| Not touched                | Every other project's folder, containers, volumes, images, `.conf` file and certificate; the proxy's compose file; firewall; SSH settings                              |

The app's container now publishes no ports: it is reached only through nginx, by name, on
`server-network`.

### Verification (from outside the server, 2026-11-04)

| Check                                        | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `https://agrosoil.market-ia.shop/`           | `307` to `/login`, with `Strict-Transport-Security` (set by our HTTPS file)   |
| `https://agrosoil.market-ia.shop/api/health` | `{"status":"ok","database":true}`                                             |
| `http://agrosoil.market-ia.shop/`            | `301` to HTTPS                                                                |
| `http://38.242.145.246:3100/`                | Connection refused: the port is closed                                        |
| Certificate served                           | Let's Encrypt, `CN=agrosoil.market-ia.shop`, valid until 2027-01-31 22:43 UTC |
| `/login` in a browser                        | Shows the new sign-in text, so the image is `main` at `fde4ea1` or later      |
| `https://market-ia.shop/`                    | `200` with its own certificate: the other site on this alias is unaffected    |

**Not verifiable from outside:** the value of `BETTER_AUTH_URL` and signing in on the domain (no
credentials were used in this check); the backup taken before updating; the copies of the nginx
file left in root's home.

### Public ports, before and after

| Port    | Before            | After                             |
| ------- | ----------------- | --------------------------------- |
| 80, 443 | `nginx`           | `nginx` (one more site, with TLS) |
| 3100    | `agrosoy-staging` | free                              |

### Observation: this site now answers for unknown names

Requests for the bare IP or for a name no `.conf` claims reach this app: on 443 they get this
certificate and the sign-in page, and on 80 a redirect to HTTPS. Apparently no file declares
`default_server`, so nginx uses the first one alphabetically, `agrosoy-staging.conf`. Sites with
their own `server_name` aren't affected. An HTTP-only site on this server opened with `https://`
would land here too, with a certificate warning.

Left as it is. The smallest fix, which leaves this choice to the next file in alphabetical order:

```bash
cd /home/apps/nginx-certbot-docker
mv conf/agrosoy-staging.conf conf/zz-agrosoy-staging.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```

- **Undo:** rename it back, test, reload.

### Pending

1. **Certificate renewal:** it can be renewed from about 2027-01-01 and expires on 2027-01-31. The
   inventory of 2026-10-29 found no scheduled renewal on the server. See
   [README.md](README.md), B5.
2. **Copies of the nginx file** in root's home (`agrosoy-staging.conf.dominio-anterior.bak`,
   `agrosoy-staging.http.conf.bak`): they can be deleted.
3. **Retired projects:** final deletion, from the previous entry.

### Undo

Back to phase A:

1. Put the old lines back in `.env` (`COMPOSE_FILE=compose.yaml:compose.ip.yaml`,
   `PUBLIC_PORT=3100`, `BETTER_AUTH_URL=http://38.242.145.246:3100`) and run `docker compose up -d`.
2. Copy `~/agrosoy-staging.http.conf.bak` to `conf/agrosoy-staging.conf`, run `nginx -t`, reload.
3. In the proxy's folder, if the certificate is no longer wanted:
   `docker compose run --rm certbot delete --cert-name agrosoil.market-ia.shop`.

To remove staging completely, follow section 8 of the previous entry, and delete the certificate
as in step 3 after removing the `.conf`.

---

## 2026-10-29/30 · Agrosoy staging deployed; two unused projects retired

### Summary

| Type                       | What                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removed                    | Containers `futures-bot-backend` and `journal-vivo`; networks `futures-bot-backend_default` and `journal_default`. Ports 3300 and 3400 released                                                                                                                           |
| Added                      | Folder `/home/apps/www/solution/agrosoy/staging`; containers `agrosoy-staging` and `agrosoy-staging-db`; network `agrosoy-staging_internal`; volume `agrosoy-staging_db-data`; images `ghcr.io/soluti0n-tech/agrosoy-web:main` and `postgres:16-alpine`; public port 3100 |
| Added to shared components | `conf/agrosoy-staging.conf` in the nginx folder (HTTP only); one line in root's crontab; a `ghcr.io` login in `/root/.docker/config.json`                                                                                                                                 |
| Changed                    | nginx reloaded once (`nginx -t` passed first). No restart                                                                                                                                                                                                                 |
| Not touched                | Every other project's folder, containers, volumes, images and `.conf` file; the proxy's compose file; certificates; firewall; SSH settings                                                                                                                                |

### 1 · Read-only inventory

Before any change, a read-only script was streamed over SSH (`ssh … bash -s < script`) and
listed: system, containers with their compose folder and networks, networks, ports, the proxy's
mounts and `.conf` files, certificates, `nginx -t` and crontab. It never read environment
variables, `.env` files or credentials. **Nothing was written to the server.**

State found that matters for the rest of this entry:

- `nginx -t` passed.
- Root had no crontab; the `certbot` container had exited 4 weeks earlier and runs only on demand.
- Docker disk: 9.3 GB of reclaimable images and 11.9 GB of build cache (not cleaned).

### 2 · Retired: `futures-bot-backend` and `journal`

Two old compose projects published ports directly to the internet and were no longer used.

| Compose project       | Folder                                                | Container             | Image                                  | Port                 | Network                       |
| --------------------- | ----------------------------------------------------- | --------------------- | -------------------------------------- | -------------------- | ----------------------------- |
| `journal`             | `/home/apps/www/solution/futures-bot-backend/journal` | `journal-vivo`        | `journal-journal-vivo` (built locally) | `0.0.0.0:3400->3400` | `journal_default`             |
| `futures-bot-backend` | `/home/apps/www/solution/futures-bot-backend`         | `futures-bot-backend` | `node:22`                              | `0.0.0.0:3300->3300` | `futures-bot-backend_default` |

Steps and results:

1. `grep -rlE 'futures-bot-backend|journal-vivo|:3300|:3400' /home/apps/nginx-certbot-docker/conf/`
   → no match: no site proxied to them, so nginx was not touched.
2. `docker compose down` in the `journal` folder (inner project first) → container and network
   removed.
3. `docker compose down` in the `futures-bot-backend` folder → container and network removed.
4. `ss -tln | grep -E ':3300 |:3400 '` → nothing listening.

**Kept on purpose:** both folders, their images and any named volumes (`down` was run without
`-v`).

- **Restore:** `docker compose up -d` in each folder brings them back exactly as before.
- **Final deletion (pending, after a waiting period):** list what is left and delete it by exact
  name:

  ```bash
  docker volume ls --filter label=com.docker.compose.project=journal
  docker volume ls --filter label=com.docker.compose.project=futures-bot-backend
  docker volume rm <listed volumes>
  docker image rm journal-journal-vivo     # node:22 only if no other container uses it
  rm -r /home/apps/www/solution/futures-bot-backend
  ```

### 3 · Added: Agrosoy staging

Agrosoy's web system (sales, receivables, inventory), staging environment for demos. Phase A of
[README.md](README.md): reached by IP and port; nginx already prepared for its domain.

**Folder**

```text
/home/apps/www/solution/agrosoy/staging/      root, compose project "agrosoy-staging"
├── compose.yaml        app + database; no published ports
├── compose.ip.yaml     publishes the app on PUBLIC_PORT (phase A only)
├── .env                600 · settings and secrets
├── backup.sh           daily dump, 30 days kept
└── backups/            700 · agrosoy-YYYY-MM-DD.dump, backup.log
```

`.env` keys (values only on the server): `ENVIRONMENT=staging`, `IMAGE_TAG=main`,
`PROXY_NETWORK=server-network`, `POSTGRES_PASSWORD` (48 hex characters, generated on the server),
`BETTER_AUTH_SECRET` (44 characters, generated on the server),
`COMPOSE_FILE=compose.yaml:compose.ip.yaml`, `PUBLIC_PORT=3100`,
`BETTER_AUTH_URL=http://38.242.145.246:3100`.

**Containers**

| Container            | Image                                                                    | Networks                                     | Ports                          | Restart          | Limits                   |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------ | ---------------- | ------------------------ |
| `agrosoy-staging`    | `ghcr.io/soluti0n-tech/agrosoy-web:main` (commit 0dccd17 at deploy time) | `agrosoy-staging_internal`, `server-network` | `0.0.0.0:3100->3000` (phase A) | `unless-stopped` | 1 GB RAM; logs 3 × 10 MB |
| `agrosoy-staging-db` | `postgres:16-alpine`                                                     | `agrosoy-staging_internal` only              | none                           | `unless-stopped` | logs 3 × 10 MB           |

- Network `agrosoy-staging_internal` (bridge, created by compose) connects only these two.
- Volume `agrosoy-staging_db-data` holds the database.
- The app applies database migrations on start and answers `GET /api/health`.
- A first administrator account was created with `create-first-admin.mjs`; its temporary password
  was changed at first sign-in.

**Registry access.** The image is private: `docker login ghcr.io` was run with a GitHub token
limited to `read:packages`. The credential is stored in `/root/.docker/config.json`. Remove it
with `docker logout ghcr.io`.

**Backups.** `./backup.sh` was run once by hand (`agrosoy-2026-10-30.dump`, 28 KB) and added to
root's crontab:

```cron
15 3 * * * cd /home/apps/www/solution/agrosoy/staging && ./backup.sh >> backups/backup.log 2>&1
```

It runs at 03:15 server time and keeps 30 days. The copy of `backup.sh` on the server predates
the repository's `umask 077`; `backups/` is `700`, so the dumps are not readable by other users.

**nginx (shared proxy).** Added `/home/apps/nginx-certbot-docker/conf/agrosoy-staging.conf`
(source: `nginx/agrosoy-staging.http.conf`):

- `server_name agrosoy.solution-services-tech.com`, port 80 only (IPv4 and IPv6).
- Serves `/.well-known/acme-challenge/` from `/var/www/certbot`, for the future certificate.
- Proxies everything else to `http://agrosoy-staging:3000` through Docker's resolver
  (`resolver 127.0.0.11` and a variable `proxy_pass`), so nginx keeps starting and reloading even
  if this app is down. Uploads up to 20 MB.

Applied with `docker exec nginx nginx -t` (passed) and `docker exec nginx nginx -s reload`. Until
the domain's DNS record exists, nobody reaches this block.

**Verification**

| Check                                                                     | Result                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `docker compose ps`                                                       | both containers `healthy`; app on `0.0.0.0:3100->3000` |
| `docker compose logs app`                                                 | `Migrations applied`, Next.js 16.4.3 ready             |
| `curl http://127.0.0.1:3100/api/health`                                   | `{"status":"ok","database":true}`                      |
| `docker exec nginx curl http://agrosoy-staging:3000/api/health`           | same: nginx reaches the app by name                    |
| `curl -I -H "Host: agrosoy.solution-services-tech.com" http://127.0.0.1/` | `307` to the app's sign-in                             |
| Browser, `http://38.242.145.246:3100`                                     | sign-in works                                          |

### 4 · Incidental

- `/root/.ssh/known_hosts` gained an entry for `38.242.145.246` (an `scp` run on the server
  itself by mistake; nothing was copied). Harmless; remove with `ssh-keygen -R 38.242.145.246`.

### 5 · Public ports, before and after

| Port                             | Before                | After                                          |
| -------------------------------- | --------------------- | ---------------------------------------------- |
| 80, 443                          | `nginx`               | `nginx` (unchanged)                            |
| 3100                             | —                     | `agrosoy-staging` (until its domain has HTTPS) |
| 3300                             | `futures-bot-backend` | free                                           |
| 3400                             | `journal-vivo`        | free                                           |
| 3600, 5432, 5434, 127.0.0.1:8080 | other projects        | unchanged                                      |

### 6 · Pending

Items 1 to 3 were done on 2026-11-02/03 with the domain `agrosoil.market-ia.shop`; see the entry
above, which also carries items 4 and 5.

1. **DNS:** A record `agrosoy.solution-services-tech.com` → `38.242.145.246`.
2. **Certificate** for that name (certbot webroot, dry run first), then replace
   `conf/agrosoy-staging.conf` with `nginx/agrosoy-staging.https.conf`, `nginx -t`, reload.
3. **Close port 3100:** remove `COMPOSE_FILE` and `PUBLIC_PORT` from `.env`, set
   `BETTER_AUTH_URL=https://agrosoy.solution-services-tech.com`, `docker compose up -d`.
4. **Certificate renewal:** the server has no scheduled `certbot renew`; every certificate on it
   expires 90 days after issue unless renewed by hand.
5. **Retired projects:** final deletion of their folders, volumes and images (section 2).

### 7 · Observations (pre-existing, not changed)

- `postgres-db` (project `siap-dde`) publishes Postgres on `0.0.0.0:5432`, and `pgadmin` (same
  project) on `0.0.0.0:5434`: both reachable from the internet.
- `llevame-backend` publishes `0.0.0.0:3600` directly, outside nginx.
- No automatic certificate renewal (see pending 4).
- 9.3 GB of unused images and 11.9 GB of build cache could be reclaimed; a global prune would
  also remove other projects' stopped containers and rollback images, so it wasn't done.

### 8 · Removing Agrosoy staging completely

In this order, each step reversible until the volume is deleted:

```bash
rm /home/apps/nginx-certbot-docker/conf/agrosoy-staging.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
cd /home/apps/www/solution/agrosoy/staging && ./backup.sh     # last backup; copy it off the server
docker compose down                                           # containers and network; data kept
crontab -l | grep -v 'agrosoy/staging' | crontab -            # backup schedule
docker volume rm agrosoy-staging_db-data                      # the data: irreversible
docker image rm ghcr.io/soluti0n-tech/agrosoy-web:main
rm -r /home/apps/www/solution/agrosoy
docker logout ghcr.io
```

### Timeline (server time, CET; in order)

| When        | What                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| 10-29 01:09 | Read-only inventory                                                                              |
| Afterwards  | `journal` and `futures-bot-backend` stopped; ports 3300 and 3400 released                        |
| Afterwards  | Registry login, folder and `.env`, images pulled, `agrosoy-staging` started, first administrator |
| 10-30 04:19 | First backup; crontab line added                                                                 |
| 10-30 04:25 | `conf/agrosoy-staging.conf` added, `nginx -t`, reload                                            |
