# Production checklist — Quỹ In Sách

Use before first production cutover. Do **not** put real secrets in this file.

## Blockers (must be done)

- [ ] Supabase Postgres: `DATABASE_URL` (pooler `:6543` + `pgbouncer=true`) and `DIRECT_URL` (`:5432`) on Render
- [ ] `npx prisma migrate deploy` succeeded (or container boot migrate OK)
- [ ] `ALLOW_DEV_LOGIN` is `false` / unset on Render
- [ ] `NODE_ENV=production`
- [ ] `SUPABASE_JWT_SECRET` set (Auth JWT secret)
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set (Storage)
- [ ] Buckets `public-media` and `private-documents` exist / creatable
- [ ] Admin Auth user exists; `users.supabase_user_id` matches Auth UUID; `role=ADMIN`
- [ ] Cloudflare Workers: `VITE_API_BASE_URL` = Render origin
- [ ] Cloudflare Workers: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (anon only)
- [ ] `frontend/wrangler.jsonc` has `not_found_handling: single-page-application` (no `_redirects`)
- [ ] Backend `CORS_ORIGINS` includes Worker HTTPS origin
- [ ] No secrets in git / frontend / Cloudflare beyond public `VITE_*`

## Smoke tests after deploy

- [ ] `GET /health` → `{"status":"ok"}`
- [ ] Public: home, product list, product detail, statistics
- [ ] Admin: login via Supabase (dev-login must 404)
- [ ] Admin: upload product cover → URL on Supabase Storage (not `/storage/...` local)
- [ ] Admin: create/confirm donation or expense still works
- [ ] Soft-delete / archive still works
- [ ] Hard refresh deep link (e.g. `/products/...`) — SPA via Workers `not_found_handling` OK

## Security

- [ ] Service role key only on Render
- [ ] Dev password unused in production
- [ ] Rotate DB password if it was ever pasted into chat/logs
- [ ] Rate limit values reviewed for public traffic

## Not required for v1.0

- [ ] Redis / shared cache across instances
- [ ] PM2 / Node cluster
- [ ] Load balancer / multiple API replicas
- [ ] PostgreSQL Docker in production
- [ ] CDN tuning beyond Cloudflare Workers Static Assets defaults
- [ ] Full load-test suite at 100 concurrent RPS

## Rollback readiness

- [ ] Know how to redeploy previous Render build
- [ ] Know how to rollback Cloudflare Workers deployment
- [ ] Supabase backup / recovery path understood
