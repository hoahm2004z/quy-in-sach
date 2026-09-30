# Quỹ In Sách – Lan Tỏa Đạo Đức Làm Người

Greenfield monorepo.

## Structure

- `backend/` — Express + Prisma + PostgreSQL
- `frontend/` — React + Vite public website (Phase 9)
- `docs/` — Architecture & operations docs

## Local development

```bash
# Database
docker compose up -d postgres

# Backend
cd backend
cp .env.example .env   # if needed
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev
# http://localhost:3000/health

# Frontend (another terminal)
cd frontend
npm install
npm run dev
# http://localhost:5173  (proxies /api → backend)
```
