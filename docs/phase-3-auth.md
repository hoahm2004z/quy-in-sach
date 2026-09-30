# Phase 3 — Authentication & Authorization

## Flow

1. Client sends `Authorization: Bearer <supabase_access_token>`
2. `authenticate` verifies JWT with `SUPABASE_JWT_SECRET` (HS256)
3. Lookup `users` by `supabase_user_id`
4. Check `is_active` + `role === ADMIN` via `authorizeAdmin`
5. Attach `req.authUser` from **PostgreSQL**, never from frontend body

## Endpoints

- `GET /api/admin/auth/me`
