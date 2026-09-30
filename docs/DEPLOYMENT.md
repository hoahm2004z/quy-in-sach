# Production deployment — Quỹ In Sách

## Architecture

| Layer | Technology | Host |
|-------|------------|------|
| Frontend | React + Vite + TypeScript | **Cloudflare Pages** (static) |
| Backend | Node.js + Express + TypeScript | **Render** (Docker) |
| Database | PostgreSQL | **Supabase** (managed) — not in Docker |
| Auth | Supabase Auth JWT (HS256) | **Supabase** |
| File storage | Supabase Storage buckets | **Supabase** — not local disk |

```
Browser → Cloudflare Pages (SPA)
       → Render API (Docker) → Supabase Postgres (pooler)
                             → Supabase Storage
       → Supabase Auth (admin sign-in) → JWT → Render /api/admin/*
```

Local `docker compose` only runs Postgres for development. **Do not** run Postgres in production Compose.

---

## Backend environment (Render)

Set in Render Dashboard (never commit values):

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | yes | `production` |
| `HOST` | yes | `0.0.0.0` |
| `PORT` | yes | Render injects `PORT`; Dockerfile default `3000` |
| `DATABASE_URL` | yes | Supabase **Transaction** pooler `:6543` + `?pgbouncer=true&schema=public` |
| `DIRECT_URL` | yes | Supabase **Session** pooler `:5432` + `?schema=public` (Prisma migrate) |
| `CORS_ORIGINS` | yes | Cloudflare Pages origin(s), comma-separated |
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_ANON_KEY` | optional | Backend may leave empty; FE uses its own anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Storage + server-side only — **never** on frontend |
| `SUPABASE_JWT_SECRET` | yes | Project JWT Secret — verify access tokens |
| `SUPABASE_PUBLIC_MEDIA_BUCKET` | yes | default `public-media` |
| `SUPABASE_PRIVATE_DOCS_BUCKET` | yes | default `private-documents` |
| `BODY_LIMIT` | recommended | e.g. `1mb` |
| `RATE_LIMIT_WINDOW_MS` | recommended | e.g. `60000` |
| `RATE_LIMIT_MAX` | recommended | e.g. `120` |
| `ALLOW_DEV_LOGIN` | yes | must be `false` or unset — boot **fails** if `true` in production |
| `DEV_ADMIN_PASSWORD` | no | unused in production |
| `PUBLIC_BASE_URL` / `LOCAL_STORAGE_DIR` | no | local fallback only; production requires Supabase Storage |

Password in connection strings: URL-encode special characters (`@` → `%40`).

---

## Frontend environment (Cloudflare Pages)

Public build-time variables only (`VITE_*`):

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_BASE_URL` | yes (prod) | Render API origin, no trailing slash |
| `VITE_SUPABASE_URL` | yes (prod) | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes (prod) | **anon** key only |

**Never** set on frontend / Cloudflare:

- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `DEV_ADMIN_PASSWORD`
- any DB password

---

## Docker backend

Files:

- `backend/Dockerfile` — multi-stage build, non-root user, `prisma migrate deploy` then `node dist/server.js`
- `backend/.dockerignore` — excludes `.env`, `node_modules`, tests, local storage

Local image smoke (optional):

```bash
cd backend
docker build -t quy-in-sach-api .
# Run only with production env injected via -e / --env-file (never bake secrets into the image)
```

Container:

- Listens on `0.0.0.0:$PORT`
- Health: `GET /health` (includes DB `SELECT 1`)
- Entrypoint runs `npx prisma migrate deploy` then starts the API

---

## Render configuration

Repo file: `render.yaml` (Blueprint).

- Runtime: Docker
- Dockerfile: `./backend/Dockerfile`
- Context: `./backend`
- Health check path: `/health`
- `autoDeploy: false` — enable when ready

Manual alternative: create a Web Service → Docker → point to `backend/Dockerfile`.

---

## Cloudflare Pages configuration

1. Connect the GitHub repo (or upload `frontend/dist`).
2. **Root directory:** `frontend`
3. **Build command:** `npm ci && npm run build`
4. **Build output directory:** `dist`
5. **Environment variables:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
6. SPA routing: `frontend/public/_redirects` → `/* /index.html 200` (copied into `dist` on build)

CORS on backend must include the Pages HTTPS origin.

---

## Supabase configuration

### PostgreSQL

- Use pooler URLs as in Backend ENV.
- Schema already applied via `prisma migrate deploy` (migration `20260928121657_init`).
- **Never** run on production: `prisma migrate reset`, `prisma migrate dev`, `prisma db push`.

### Auth

1. Enable Email/Password in Supabase Auth.
2. Create admin user in Auth.
3. Ensure `public.users` row exists with matching `supabase_user_id` (= Auth user UUID), `role=ADMIN`, `is_active=true`.
4. Frontend signs in with anon key → sends `Authorization: Bearer <access_token>` to API.
5. Backend verifies JWT with `SUPABASE_JWT_SECRET` and loads role from Postgres (not from JWT claims).

### Storage

1. Create buckets `public-media` (public) and `private-documents` (private), or let backend `ensureBuckets()` create them with service role.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Render.
3. Production **refuses to start** without Storage configured (no local filesystem uploads).

---

## Migration procedure

```bash
# Prefer letting the container run migrate on boot.
# Or one-shot from CI/laptop with production DIRECT_URL + DATABASE_URL set:

cd backend
npx prisma migrate deploy
```

Safe: additive migrations only.  
Unsafe on prod: `migrate reset`, `db push`, `migrate dev`.

---

## Deploy procedure (order)

1. Confirm Supabase DB schema is up to date (`migrate deploy`).
2. Configure Supabase Auth admin + `users` row.
3. Configure Storage buckets + backend Storage env.
4. Deploy backend on Render with env vars; wait for `/health` = `{ "status": "ok" }`.
5. Set Cloudflare Pages `VITE_*` to the Render URL + Supabase public keys; build & deploy frontend.
6. Set `CORS_ORIGINS` to the Pages URL; redeploy backend if needed.
7. Smoke-test: public home, product list, admin login (Supabase), upload cover image.

---

## Health check

```bash
curl -sS https://<RENDER_HOST>/health
# {"status":"ok"}
```

Failure usually means DB connectivity or process crash (check Render logs / missing production env).

---

## Basic rollback

1. **Frontend:** redeploy previous Cloudflare Pages deployment.
2. **Backend:** redeploy previous Render image/commit.
3. **Database:** restore from Supabase backup / PITR if a bad migration shipped (avoid destructive migrations).
4. Keep a known-good `DATABASE_URL` / secrets in a password manager — not in git.

---

## Post-deploy checklist

See `docs/PRODUCTION-CHECKLIST.md`.
