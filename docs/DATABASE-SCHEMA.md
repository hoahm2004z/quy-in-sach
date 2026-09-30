# Full Database Schema — Quỹ In Sách

**Nguồn:** `backend/prisma/schema.prisma`  
**Engine:** PostgreSQL · DB local: `quy_in_sach` @ `localhost:5433`

---

## Enums

| Enum | Giá trị |
|------|---------|
| `UserRole` | `ADMIN` |
| `ProductType` | `BOOK`, `SPEAKER` |
| `ProductStatus` | `UPCOMING`, `PRINTED`, `ARCHIVED` |
| `DonationStatus` | `PENDING`, `CONFIRMED`, `VOIDED` |
| `ExpenseStatus` | `PENDING`, `CONFIRMED`, `VOIDED` |

---

## 1. `users`

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `supabase_user_id` | TEXT UNIQUE | Liên kết Auth |
| `email` | TEXT UNIQUE | |
| `full_name` | TEXT | |
| `role` | UserRole | mặc định ADMIN |
| `is_active` | BOOLEAN | mặc định true |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 2. `media`

Metadata file (file thật ở Storage / `.local-storage`).

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `bucket` | TEXT | `public-media` / `private-documents` |
| `storage_path` | TEXT | |
| `file_name` | TEXT | |
| `mime_type` | TEXT | |
| `file_size` | INT | |
| `alt_text` | TEXT? | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP? | soft delete |
| `deleted_by` | UUID? FK → users | |
| `delete_reason` | TEXT? | |

Index: `media_deleted_at_idx`

---

## 3. `products`

**Không có cột `actual_cost`** — tính từ `SUM(expenses.amount)` WHERE status=`CONFIRMED` AND product_id=...

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `description` | TEXT? | |
| `product_type` | ProductType | BOOK / SPEAKER |
| `status` | ProductStatus | UPCOMING / PRINTED / ARCHIVED |
| `budget_estimate` | DECIMAL(18,2) | mặc định 0 |
| `planned_quantity` | INT | |
| `printed_quantity` | INT | |
| `stock_quantity` | INT | |
| `planned_date` | DATE? | |
| `completed_date` | DATE? | |
| `cover_media_id` | UUID? FK → media | ON DELETE SET NULL |
| `is_public` | BOOLEAN | mặc định true |
| `created_by` | UUID FK → users | |
| `updated_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP? | soft delete |
| `deleted_by` | UUID? FK → users | |
| `delete_reason` | TEXT? | |

Indexes: type+status, public+deleted, created_at

---

## 4. `donations` (khoản thu)

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `donor_name` | TEXT | nội bộ — **không** lộ Public |
| `display_name` | TEXT? | tên hiển thị Public |
| `is_anonymous` | BOOLEAN | |
| `amount` | DECIMAL(18,2) | |
| `donated_at` | TIMESTAMPTZ | |
| `content` | TEXT? | |
| `product_id` | UUID? FK → products | ON DELETE RESTRICT |
| `status` | DonationStatus | PENDING / CONFIRMED / VOIDED |
| `is_public` | BOOLEAN | |
| `proof_media_id` | UUID? FK → media | private proof |
| `note` | TEXT? | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP? | |
| `deleted_by` | UUID? | |
| `delete_reason` | TEXT? | |

Chỉ `CONFIRMED` + `deleted_at IS NULL` tính vào tổng thu.

---

## 5. `expenses` (khoản chi)

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `product_id` | UUID? FK → products | **bắt buộc nếu category = `In ấn`** |
| `category` | TEXT | vd: In ấn, Vận chuyển… |
| `amount` | DECIMAL(18,2) | |
| `expense_date` | DATE | |
| `description` | TEXT | |
| `invoice_media_id` | UUID? FK → media | |
| `status` | ExpenseStatus | PENDING / CONFIRMED / VOIDED |
| `is_public` | BOOLEAN | |
| `note` | TEXT? | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP? | |
| `deleted_by` | UUID? | |
| `delete_reason` | TEXT? | |

`actualCost(product)` = SUM amount WHERE product_id + CONFIRMED + chưa xóa.

---

## 6. `companions` (người đồng hành)

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `display_name` | TEXT | |
| `note` | TEXT? | |
| `is_public` | BOOLEAN | |
| `sort_order` | INT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP? | |
| `deleted_by` | UUID? FK → users | |
| `delete_reason` | TEXT? | |

Độc lập với donations.

---

## 7. `audit_logs`

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `user_id` | UUID? FK → users | |
| `action` | TEXT | CREATE / UPDATE / CONFIRM / VOID / ARCHIVE / SOFT_DELETE / RESTORE… |
| `entity` | TEXT | product / donation / expense / companion / media… |
| `entity_id` | TEXT | |
| `old_value` | JSON? | |
| `new_value` | JSON? | |
| `ip` | TEXT? | |
| `user_agent` | TEXT? | |
| `created_at` | TIMESTAMP | append-only |

---

## 8. `settings`

| Cột DB | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | UUID PK | |
| `key` | TEXT UNIQUE | |
| `value` | JSON | |
| `updated_by` | UUID? FK → users | |
| `updated_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

---

## Quan hệ chính (tóm tắt)

```
users
  ├── products (created_by / updated_by / deleted_by)
  ├── donations, expenses, media, companions, audit_logs, settings

media
  ├── products.cover_media_id
  ├── donations.proof_media_id
  └── expenses.invoice_media_id

products
  ├── donations.product_id
  └── expenses.product_id
```

---

## Kết nối local

```
DATABASE_URL=postgresql://quyinsach:quyinsach@localhost:5433/quy_in_sach?schema=public
```

Xem schema gốc: `backend/prisma/schema.prisma`  
Prisma Studio: `cd backend && npm run prisma:studio`
