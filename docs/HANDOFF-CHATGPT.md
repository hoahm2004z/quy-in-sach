# BÁO CÁO BÀN GIAO DỰ ÁN — QUỸ IN SÁCH

**Tên dự án:** Quỹ In Sách – Lan Tỏa Đạo Đức Làm Người  
**Mục đích tài liệu:** Cho ChatGPT / AI / dev khác đọc và **tiếp tục đúng chỗ**, không làm lại từ đầu, không đổi stack tùy ý.  
**Ngày cập nhật:** 2026-09-28  
**Trạng thái tổng:** Backend Phase 1–8 + một phần Phase 12 API xong; Frontend Public (Phase 9) + Admin (Phase 10) xong; **chưa** Media/Storage (Phase 11), hardening đầy đủ, Docker production cuối cùng.

**Workspace path:** `C:\C-APP\Quy in sach dao duc`

---

## 1. MỤC TIÊU HỆ THỐNG

- Website **PUBLIC** minh bạch: sách sắp in / đã in, loa pháp thoại, thu–chi, số dư, người đồng hành.
- Khu vực **ADMIN** (`/admin`) quản lý dữ liệu; bắt buộc đăng nhập.
- Tài chính: không hard-code tổng thu/chi/số dư; soft delete; void thay hard delete; có audit log.
- Kiến trúc: **modular monolith**, đơn giản, chi phí thấp, ~100 concurrent nếu hạ tầng ổn.
- UI: **100% tiếng Việt** (public + admin).

---

## 2. TECH STACK ĐÃ CHỐT (KHÔNG ĐỔI TÙY Ý)

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | React, Vite, TypeScript, React Router, **MUI v6**, TanStack Query, React Hook Form (đã cài), Zod |
| Backend | Node.js, Express, TypeScript, Prisma **6.19** |
| DB | PostgreSQL (Docker local port **5433**) |
| Auth | Supabase Auth (JWT HS256 verify); local có **dev-login** |
| Storage | Supabase Storage — **chưa implement upload** (Phase 11) |
| Test | Jest + Supertest (backend) |
| Không dùng 1.0 | Redux, GraphQL, microservices, Redis, WebSocket, Kafka… |

**Lưu ý Prisma:** Không nâng lên Prisma 8 RC — CLI hoàn toàn khác, phá `migrate`/`generate`.

**Lưu ý MUI:** Dùng **v6** (v9 bỏ system props, gây lỗi TS hàng loạt).

**Backend tsconfig:** `"module": "Node16"`, `"moduleResolution": "Node16"`, `"isolatedModules": true`.

---

## 3. CÁCH CHẠY LOCAL

```bash
# 1) Database
cd "C:\C-APP\Quy in sach dao duc"
docker compose up -d postgres
# Postgres: localhost:5433 / user: quyinsach / pass: quyinsach / db: quy_in_sach

# 2) Backend
cd backend
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev
# http://localhost:3000/health

# 3) Frontend
cd frontend
npm install
npm run dev
# http://localhost:5173  (proxy /api → :3000)
```

### Tài khoản admin local (dev-login)

- URL: `http://localhost:5173/admin/login`
- Email: `admin@quyinsach.local`
- Password: `admin123`
- Điều kiện: `ALLOW_DEV_LOGIN=true` trong `backend/.env`
- JWT secret: `SUPABASE_JWT_SECRET` trong `.env` (đã có giá trị dev)

### Kiểm tra nhanh

```bash
cd backend
npm run typecheck
npm test          # kỳ vọng 32 passed
npm run build

cd frontend
npm run typecheck
npm run lint
npm run build
```

---

## 4. CẤU TRÚC THƯ MỤC

```
Quy in sach dao duc/
  backend/
    prisma/schema.prisma
    prisma/migrations/
    prisma/seed.ts
    src/
      app.ts
      server.ts
      config/
      middlewares/     # error, validate, rateLimit
      modules/
        auth/
        products/
        donations/
        expenses/
        companions/    # + audit list + trash aggregate routes
        dashboard/
        transparency/  # public API
        media/         # CHƯA có logic upload
        audit/         # writeAuditLog helper
      utils/
    tests/
  frontend/
    src/
      app/AppRouter.tsx
      layouts/PublicLayout.tsx, AdminLayout.tsx
      pages/public/    # Home, Products, Detail, Transparency
      pages/admin/     # Login, Dashboard, Products, Donations, Expenses, Companions, Audit, Trash
      features/
      services/publicApi.ts, adminApi.ts
      theme/publicTheme.ts
      utils/format.ts  # nhãn tiếng Việt cho status/audit
  docs/
  docker-compose.yml
  README.md
```

---

## 5. DATABASE (PRISMA) — ĐIỂM QUAN TRỌNG

### Models

`users`, `products`, `donations`, `expenses`, `companions`, `media`, `audit_logs`, `settings`

### Enums

- `UserRole`: ADMIN  
- `ProductType`: BOOK | SPEAKER  
- `ProductStatus`: UPCOMING | PRINTED | ARCHIVED  
- `DonationStatus` / `ExpenseStatus`: PENDING | CONFIRMED | VOIDED  

### Quy tắc bắt buộc

1. **KHÔNG có cột `actual_cost` trên products.**  
   Tính: `SUM(expenses.amount) WHERE product_id=… AND status=CONFIRMED AND deleted_at IS NULL`

2. Soft delete: `deleted_at`, `deleted_by`, `delete_reason`

3. Phân biệt: ARCHIVED ≠ soft delete ≠ VOIDED

4. FK tài chính → product: **không cascade delete** (`onDelete: Restrict`)

5. Public filter:
   - Tất cả: `is_public=true AND deleted_at IS NULL` (và không ARCHIVED trên public list)
   - Sách sắp in: BOOK + UPCOMING  
   - Sách đã in: BOOK + PRINTED  
   - Loa: SPEAKER  

6. Tài chính công khai:
   - Tổng thu/chi chỉ CONFIRMED + deleted_at null  
   - Public donation: không trả `donorName`; ẩn danh → “Người đóng góp ẩn danh”

---

## 6. API ĐÃ CÓ

### System
- `GET /health` → `{ status: "ok" }`

### Public (`/api/public/...`)
- `GET /products` (query: type, status, page, pageSize)
- `GET /products/:id` (+ relatedExpenses public)
- `GET /statistics` → totalIncome, totalExpense, balance, upcomingBudget
- `GET /donations`, `/expenses`, `/companions`

### Admin (Bearer JWT + role ADMIN từ bảng `users`)
- `POST /api/admin/auth/dev-login` (chỉ khi ALLOW_DEV_LOGIN)
- `GET /api/admin/auth/me`
- `GET /api/admin/dashboard`
- Products: CRUD + archive + delete + restore
- Donations: CRUD + confirm + void + delete + restore  
  - Update chỉ khi PENDING; confirm atomic → 409 nếu trùng
- Expenses: tương tự donations
- Companions: GET/POST/PUT + delete + restore
- `GET /api/admin/audit-logs`
- `GET /api/admin/trash` + `POST /api/admin/trash/:id/restore` body `{ entity }`

### Envelope

Success: `{ success: true, data, meta? }`  
Error: `{ success: false, message, code, details? }`

---

## 7. FRONTEND ĐÃ CÓ

### Public routes
- `/` trang chủ  
- `/products` + filter 4 mục  
- `/products/:id`  
- `/transparency`  

### Admin routes (lazy tách bundle)
- `/admin/login`
- `/admin` tổng quan
- `/admin/products` — Thêm / Sửa / Lưu trữ / Xóa
- `/admin/donations` — Thêm / Sửa (PENDING) / Xác nhận / Hủy giao dịch
- `/admin/expenses` — tương tự
- `/admin/companions` — Thêm / Sửa / Xóa đầy đủ
- `/admin/audit-logs` (chỉ xem)
- `/admin/trash` (khôi phục)

### UX đã chốt gần đây
- Nút thêm chỉ ghi **「Thêm」** (không “Thêm sản phẩm…”)
- Chip/status/audit action: **tiếng Việt** (`utils/format.ts`)
- Không hard-code số liệu quỹ trên FE

---

## 8. VIỆC ĐÃ XONG THEO PHASE

| Phase | Nội dung | Status |
|------|----------|--------|
| 0 | Inspect (greenfield) | Done |
| 1 | Prisma schema + migrate + seed | Done |
| 2 | Express foundation, health, errors | Done |
| 3 | Auth JWT + authorizeAdmin | Done |
| 4 | Products | Done |
| 5 | Donations (+ concurrent confirm) | Done |
| 6 | Expenses | Done |
| 7 | Dashboard | Done |
| 8 | Public API + in-memory cache | Done |
| 9 | Public Frontend | Done |
| 10 | Admin Frontend | Done (dev-login) |
| 11 | Media / Supabase Storage | **Done** (local fallback nếu chưa có Supabase keys) |
| 12 một phần | Companions/Audit/Trash API + soft-delete UI thu/chi | Done |
| 13 | Perf/security hardening đầy đủ | **CHƯA** |
| 14 | Full test matrix theo spec | **CHƯA** (hiện 36 tests) |
| 15 | Docker/Nginx/docs production | **CHƯA** (có docker-compose postgres) |

---

## 9. VIỆC CẦN LÀM TIẾP (ƯU TIÊN)

### Auth production
- Thay/ bổ sung Supabase Auth thật (email/password)
- Tắt `ALLOW_DEV_LOGIN` trên production
- Sync `users.supabase_user_id` khi tạo admin

### Phase 13–15
- Rate limit tách public/admin, Helmet/CSP production
- Cache invalidate đủ mọi mutation còn sót
- Tests: mass assignment, rate limit, … (media upload/private đã có)
- Dockerfile backend, nginx, `.env.example` production, docs backup/restore

### Frontend polish (nếu cần)
- Supabase client login thay dev-login
- SEO/meta chi tiết hơn

### Phase 11 Media — đã có
- Buckets: `public-media`, `private-documents`
- API: `POST /api/admin/media/upload-url`, `confirm`, `access-url`, soft-delete, restore
- Public DTO: `coverUrl` (URL Storage trực tiếp; local: `/storage/public-media/...`)
- Admin forms: upload ảnh bìa / chứng từ / hóa đơn
- Service Role Key chỉ ở backend

---

## 10. QUY TẮC KHI TIẾP TỤC CODE

1. **Không rewrite** toàn bộ; không xóa module đang chạy.
2. **Không đổi stack** nếu không có blocker.
3. Làm **theo phase**; sau mỗi phase: typecheck → test → build → báo cáo.
4. Business logic **chỉ ở backend**; FE không quyết định role/số dư.
5. Thông báo lỗi API / UI: **tiếng Việt**.
6. Confirm tài chính: conditional update / 409 conflict.
7. Public DTO ≠ Admin DTO (không lộ note, donorName, audit…).
8. Service Role Key **không** đưa xuống frontend.

---

## 11. FILE CẤU HÌNH QUAN TRỌNG

- `backend/.env` — DATABASE_URL port 5433, JWT secret, ALLOW_DEV_LOGIN, `PUBLIC_BASE_URL`, buckets  
- `backend/.env.example`  
- `frontend/.env` — `VITE_API_BASE_URL=` (rỗng = dùng proxy Vite `/api` + `/storage`)  
- `docker-compose.yml` — postgres:16, host port 5433  
- `docs/PROGRESS.md` — tiến độ ngắn
- `backend/.local-storage/` — fallback Storage local (gitignore)  

---

## 12. LỖI / BẪY ĐÃ GẶP (TRÁNH LẶP LẠI)

1. `npm i prisma@latest` kéo Prisma 8 RC → CLI gãy → **pin Prisma 6**.
2. MUI 9 → Stack/Typography mất system props → **pin MUI 6**.
3. Express 5: `req.query` readonly → validate ghi vào `req.validated`.
4. `moduleResolution: "node"` đỏ trên TS mới → dùng **Node16**.
5. Test `actualCost` đừng phụ thuộc tên seed cố định (DB có thể bị admin sửa) — test tự tạo data.
6. Chỉ mount static **public-media**; không expose `private-documents` qua `/storage`.

---

## 13. PROMPT GỢI Ý CHO CHATGPT KHI BẮT ĐẦU

Copy đoạn này:

```
Bạn tiếp tục dự án “Quỹ In Sách” tại C:\C-APP\Quy in sach dao duc.
Đọc file docs/HANDOFF-CHATGPT.md (báo cáo bàn giao này) trước khi code.
Hiện xong Phase 1–11 (+ soft-delete UI thu/chi).
Việc tiếp theo: Auth Supabase production hoặc Phase 13 hardening.
Không đổi stack, không rewrite, giữ tiếng Việt UI, mọi business logic ở backend.
Sau khi xong: typecheck + test + build + báo cáo file/API.
```

---

## 14. TÓM TẮT MỘT CÂU

**Monolith Express+Prisma+Postgres + React/MUI đã có public minh bạch, admin CRUD tiếng Việt, Media/Storage (signed upload); việc lớn còn lại là Auth Supabase production, hardening và deploy.**
