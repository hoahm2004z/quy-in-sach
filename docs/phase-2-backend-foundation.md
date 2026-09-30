# Phase 2 — Backend foundation

## Stack

- Express + TypeScript (strict)
- Helmet, CORS whitelist, rate limit, body size limit
- Zod validation middleware
- Unified error envelope: `{ success, message, code, details? }`
- `GET /health` → `{ status: "ok" }` (+ DB ping)

## Entry

- `src/app.ts` — createApp()
- `src/server.ts` — listen + graceful shutdown
