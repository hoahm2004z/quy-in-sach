# Báo cáo lưu trữ dữ liệu hiện tại

**Ngày:** 2026-09-28  
**Phạm vi:** Chỉ dựa trên code/config trong repo `C:\C-APP\Quy in sach dao duc`. Không suy đoán hosting production chưa có trong config.

---

## 1. Dữ liệu nghiệp vụ đang lưu ở đâu?

| Hạng mục | Giá trị thực tế hiện tại |
|----------|---------------------------|
| Engine | **PostgreSQL 16** (`postgres:16-alpine` trong Docker) |
| Host (từ máy dev) | `localhost` |
| Port (host) | **5433** → map vào container port `5432` |
| Database name | **`quy_in_sach`** |
| User / password | `quyinsach` / `quyinsach` |
| Schema | `public` (Prisma `?schema=public`) |
| Connection string | `backend/.env` → `DATABASE_URL="postgresql://quyinsach:quyinsach@localhost:5433/quy_in_sach?schema=public"` |
| Container | `quyinsach-postgres` (service `postgres` trong `docker-compose.yml`) |

### Các bảng chính (Prisma `@@map`)

| Model Prisma | Bảng PostgreSQL |
|--------------|-----------------|
| `User` | `users` |
| `Media` | `media` |
| `Product` | `products` |
| `Donation` | `donations` |
| `Expense` | `expenses` |
| `Companion` | `companions` |
| `AuditLog` | `audit_logs` |
| `Setting` | `settings` |

ORM: **Prisma 6** (`backend/prisma/schema.prisma`).

---

## 2. Thêm / sửa / xóa ghi vào bảng nào?

Mọi thao tác admin đi qua Express API → Prisma → PostgreSQL. Soft-delete ghi `deleted_at` (không hard-delete bản ghi nghiệp vụ qua UI).

| Thực thể UI | Bảng chính | Ghi chú |
|-------------|------------|---------|
| Sách / loa | **`products`** | `cover_media_id` → FK tới `media` (nếu có ảnh) |
| Khoản thu | **`donations`** | `proof_media_id` → FK tới `media` (nếu có) |
| Khoản chi | **`expenses`** | `invoice_media_id` → FK tới `media` (nếu có) |
| Người đồng hành | **`companions`** | Không gắn media trong schema hiện tại |

**Phụ:** hầu hết create/update/delete/confirm/void/archive còn ghi thêm vào **`audit_logs`**.

**Không lưu** số dư quỹ / `actual_cost` dạng cột cố định: chi phí thực tế của sản phẩm được **tính từ** các dòng `expenses` đã `CONFIRMED`.

---

## 3. Ảnh hiện tại đang lưu ở đâu?

### Trạng thái config hiện tại (`backend/.env`)

```
SUPABASE_URL=               (rỗng)
SUPABASE_ANON_KEY=          (rỗng)
SUPABASE_SERVICE_ROLE_KEY=  (rỗng)
```

→ Code chọn **LocalStorageProvider** (`isSupabaseStorageConfigured()` = false khi thiếu URL + Service Role Key).

| Thành phần | Nơi lưu |
|------------|---------|
| **File ảnh / PDF** | **Local filesystem:** `backend/.local-storage/` (env `LOCAL_STORAGE_DIR=.local-storage`) |
|  | ├── `public-media/` (ảnh bìa công khai) |
|  | └── `private-documents/` (chứng từ / hóa đơn) |
| **Metadata** | Bảng PostgreSQL **`media`** (`bucket`, `storage_path`, `file_name`, `mime_type`, `file_size`, …) |
| **URL public** | `http://localhost:3000/storage/public-media/...` (static Express, chỉ bucket public) |
| **URL private** | Signed download qua `/api/admin/media/.../access-url` → local-download JWT |

**Không** phải URL demo cứng trong frontend.  
**Có** upload thật (signed PUT → ghi file local + confirm metadata).  
**Chưa** dùng Supabase Storage trên môi trường local hiện tại vì keys trống.

(Đã kiểm tra: thư mục `backend/.local-storage/public-media` và `private-documents` tồn tại trên disk.)

---

## 4. `media` đã dùng thực tế chưa?

| Hạng mục | Trạng thái |
|----------|-----------|
| Model / table `media` | **Có** — Prisma schema + DB |
| API admin | **Có** — `/api/admin/media/upload-url`, `confirm`, `access-url`, `delete`, `restore` |
| Frontend upload | **Có** — `MediaUploadField` trong form sản phẩm / khoản thu / khoản chi |
| Storage provider (local hiện tại) | **`local`** |
| Storage provider (khi điền Supabase keys) | **`supabase`** (`@supabase/supabase-js` + Service Role ở backend) |
| Public hiển thị | **Có** — DTO có `coverUrl`; `ProductCover` load URL |

---

## 5. Seed nằm ở đâu và lệnh nào?

| Mục | Chi tiết |
|-----|----------|
| File | `backend/prisma/seed.ts` |
| Cấu hình npm | `"prisma": { "seed": "tsx prisma/seed.ts" }` trong `backend/package.json` |
| Lệnh seed tường minh | `cd backend` → `npm run prisma:seed` |
| Lệnh reset + migrate + seed | `npm run db:reset` (= `prisma migrate reset --force`, Prisma chạy seed sau migrate) |
| Nội dung seed | Admin `admin@quyinsach.local`, vài `products` / `donations` / `expenses` / `companions` / `settings`; **không** seed file ảnh |

---

## 6. Tắt / restart Docker PostgreSQL — dữ liệu còn không?

| Câu hỏi | Trả lời theo config |
|---------|---------------------|
| Restart container / `docker compose restart` | **Còn** — data trong volume |
| `docker compose down` (không `-v`) | **Còn** — volume giữ lại |
| `docker compose down -v` / xóa volume | **Mất** data Postgres |

**Volume Docker (khai báo trong `docker-compose.yml`):**

```yaml
volumes:
  quyinsach_pgdata:
```

Mount: `quyinsach_pgdata:/var/lib/postgresql/data`

**Tên volume thực tế trên máy đã chạy compose** (Docker Compose prefix theo tên project thư mục):

- `quyinsachdaoduc_quyinsach_pgdata`

**Ảnh local** (`backend/.local-storage`) **không** nằm trong Docker volume Postgres — nằm trên disk máy host, cạnh code backend. Restart Postgres **không** xóa ảnh local. Xóa thư mục `.local-storage` hoặc clone máy mới thì mất file ảnh (metadata trong DB vẫn có thể còn).

---

## 7. Deploy production sau này — theo code/config hiện có

**Trong repo hiện tại:**

- **Không có** `Dockerfile` backend/frontend  
- **Không có** config nginx production  
- **Không có** file `.env` production với host DB/Storage thật  

Do đó **chưa có địa chỉ hosting production đã cấu hình**. Chỉ có kiến trúc trong code/docs:

| Thành phần | Thiết kế trong code (chưa deploy config) |
|------------|------------------------------------------|
| Database | PostgreSQL qua `DATABASE_URL` (production URL sẽ thay trong env — **chưa set**) |
| Ảnh | Supabase Storage buckets `public-media` / `private-documents` khi có `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; fallback local **không** phù hợp production lâu dài |
| Backend | Node/Express (`PORT`, hiện default 3000) — host chưa định |
| Frontend | Vite React SPA; `VITE_API_BASE_URL` (local đang rỗng = proxy Vite) — host chưa định |
| Auth | Supabase JWT (`SUPABASE_JWT_SECRET`); local còn `ALLOW_DEV_LOGIN` |

Phase 15 (Docker/Nginx/docs production) trong handoff vẫn ghi **CHƯA**.

---

## 8. File cấu hình liên quan (chính xác)

### DATABASE_URL
- `backend/.env` (runtime local)
- `backend/.env.example`
- `backend/prisma/schema.prisma` → `env("DATABASE_URL")`

### Supabase
- `backend/.env` / `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `backend/src/config/env.ts` (validate env)
- `backend/src/modules/auth/jwt.ts` (verify JWT)
- `backend/src/modules/media/storage.supabase.ts` (Storage client)

### Storage
- `backend/.env`: `SUPABASE_PUBLIC_MEDIA_BUCKET`, `SUPABASE_PRIVATE_DOCS_BUCKET`, `PUBLIC_BASE_URL`, `LOCAL_STORAGE_DIR`
- `backend/src/modules/media/storage.ts` (chọn provider)
- `backend/src/modules/media/storage.local.ts`
- `backend/src/app.ts` (static `/storage/public-media`)
- `.gitignore` → `backend/.local-storage/`

### Docker volume
- `docker-compose.yml` → volume name `quyinsach_pgdata`, mount `/var/lib/postgresql/data`

### Frontend API
- `frontend/.env` → `VITE_API_BASE_URL=` (rỗng)
- `frontend/vite.config.ts` → proxy `/api`, `/health`, `/storage` → `http://localhost:3000`

---

## Tóm tắt một câu

**Local hiện tại: toàn bộ CRUD nghiệp vụ nằm trong PostgreSQL Docker (`localhost:5433` / DB `quy_in_sach` / volume `quyinsach_pgdata`); metadata ảnh trong bảng `media`; file ảnh thật trên disk `backend/.local-storage` vì Supabase Storage chưa cấu hình keys; production hosting chưa được định nghĩa bằng config trong repo.**
