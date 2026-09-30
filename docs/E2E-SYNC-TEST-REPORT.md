# E2E Sync Test Report — Quỹ In Sách

**Ngày:** 2026-09-28  
**Phạm vi:** Đồng bộ Admin API → Business logic → PostgreSQL → Cache → Public API  
**Công cụ:** Jest + Supertest (backend). Frontend **không** có Vitest/Playwright trong project → luồng nút UI được ánh xạ 1:1 sang API mà Admin UI gọi; kiểm tra RQ invalidate bằng code review.

---

## 1. Test overview

| Suite | File | Vai trò |
|-------|------|---------|
| Sync E2E | `backend/tests/sync-e2e.test.ts` | Luồng nghiệp vụ đầy đủ (22 cases) |
| Helpers | `backend/tests/helpers/sync.ts` | Auth, upload, audit helpers |
| Cũ | `products/donations/expenses/public/media/auth/health` | Coverage module |

**Lệnh:** `cd backend && npm test`

---

## 2. Button matrix (Admin UI thực tế)

| Button | Page | Action | API | DB | Public effect | Audit | Sync test |
|--------|------|--------|-----|-----|---------------|-------|-----------|
| Thêm | Products | Create | `POST /api/admin/products` | `products` | List nếu `isPublic` | CREATE | PASS |
| Lưu (dialog) | Products | Create/Update | POST/PUT products | `products` | Cache invalidate + list/detail | CREATE/UPDATE | PASS |
| Sửa | Products | Open form + PUT | PUT products | fields | Filters BOOK/SPEAKER, UPCOMING/PRINTED | UPDATE | PASS |
| Lưu trữ | Products | Archive | `POST .../archive` | status=ARCHIVED | Không còn public list | ARCHIVE | PASS |
| Xóa / Xóa (confirm) | Products | Soft delete | `POST .../delete` | `deleted_at` | 404 public | SOFT_DELETE | PASS |
| Chọn/Thay/Gỡ ảnh | Products (MediaUploadField) | Upload+confirm+FK | media + PUT coverMediaId | `media` + `cover_media_id` | `coverUrl` | MEDIA_* / UPDATE | PASS |
| Thêm | Donations | Create | POST donations | `donations` PENDING | Không +income | CREATE | PASS |
| Lưu | Donations | Update PENDING | PUT donations | fields | — | UPDATE | PASS |
| Xác nhận | Donations | Confirm | `POST .../confirm` | CONFIRMED | +totalIncome; list nếu public | CONFIRM | PASS |
| Hủy giao dịch | Donations | Void | `POST .../void` | VOIDED | −income nếu đã confirm | VOID | PASS |
| Xóa | Donations | Soft delete PENDING/VOIDED | `POST .../delete` | `deleted_at` | — | SOFT_DELETE | PASS |
| Upload chứng từ | Donations | Private media | media + proofMediaId | `media` private | Public không đọc file | MEDIA_* | PASS |
| Thêm | Expenses | Create | POST expenses | PENDING | Không +expense | CREATE | PASS |
| Lưu | Expenses | Update PENDING | PUT | fields | — | UPDATE | PASS |
| Xác nhận | Expenses | Confirm | `POST .../confirm` | CONFIRMED | +totalExpense; actualCost | CONFIRM | PASS |
| Hủy giao dịch | Expenses | Void | `POST .../void` | VOIDED | Rollback totals/cost | VOID | PASS |
| Xóa | Expenses | Soft delete | `POST .../delete` | `deleted_at` | — | SOFT_DELETE | PASS |
| Upload hóa đơn | Expenses | Private media | invoiceMediaId | private bucket | Không public | MEDIA_* | PASS |
| Thêm / Lưu / Sửa / Xóa | Companions | CRUD | companions API | `companions` | Public list sync | CREATE/UPDATE/SOFT_DELETE | PASS |
| Khôi phục | Trash | Restore | `POST /api/admin/trash/:id/restore` | clear `deleted_at` | Public hiện lại nếu public | RESTORE | PASS |
| Đăng nhập | Login | Dev login | `POST /api/admin/auth/dev-login` | — | — | — | Covered auth suite |
| (xem) | Dashboard / Audit | GET | dashboard / audit-logs | read | — | — | PASS (dashboard vs DB) |

**Dialog Hủy** = đóng UI, không gọi API (không cần sync DB).

---

## 3. Admin → API → DB

Đã verify bằng Prisma `findUnique` sau mỗi mutation trong `sync-e2e.test.ts`.

---

## 4. DB → Public API

| Case | Kết quả |
|------|---------|
| Product UPCOMING → PRINTED | Không còn filter UPCOMING; có PRINTED |
| Soft delete / archive | Public 404 / không list |
| Restore | Public 200 lại |
| Donation PENDING | Không trong `/donations`, income không tăng |
| Donation CONFIRMED + public | Có trong list; **không** có `donorName` |
| Anonymous | `displayName` = «Người đóng góp ẩn danh» |
| Statistics | Khớp aggregate CONFIRMED |

---

## 5. Public UI

| Hạng mục | Cách kiểm tra | Status |
|----------|---------------|--------|
| Filters /products | Public API query type/status (cùng params FE `filterToQuery`) | PASS (API) |
| Chi tiết /products/:id | Public GET by id + coverUrl | PASS (API) |
| Minh bạch stats/donations/expenses/companions | Public endpoints | PASS (API) |
| Click browser / pagination UI | **SKIPPED** — chưa có Playwright trong repo | SKIPPED |

Admin/Public React Query: sau mutation Admin gọi `invalidateQueries` đúng key (`admin/*`). Public là session khác / TTL cache server — đồng bộ server đã test.

---

## 6. Cache synchronization

| Mutation | Trước fix | Sau fix |
|----------|-----------|---------|
| Product create/update | invalidate OK | OK |
| Product archive/delete/restore | **THIẾU** invalidate | **Đã sửa** + test PASS |
| Donation create/update/delete/restore | **THIẾU** | **Đã sửa** |
| Donation confirm/void | OK | OK |
| Expense create/update/delete/restore | **THIẾU** | **Đã sửa** |
| Expense confirm/void | OK | OK |
| Companion all | OK | OK |
| Media confirm/delete/restore | OK | OK |

Test: warm cache → mutate → public list thấy data mới ngay.

---

## 7. Financial synchronization

| Rule | Result |
|------|--------|
| PENDING không vào tổng | PASS |
| CONFIRMED +amount | PASS |
| VOIDED không tính | PASS |
| `balance = income − expense` | PASS |
| Dashboard = DB aggregates | PASS |
| `actualCost` = SUM(CONFIRMED expenses) — không cột hard-code | PASS |

---

## 8. Media synchronization

| Case | Result |
|------|--------|
| Upload cover → file local + `media` + `coverUrl` public | PASS |
| Thay cover | PASS |
| Soft-delete media → detach FK product | PASS |
| Restore media | PASS |
| Private proof/invoice: static 404, anon 401, admin access-url 200 | PASS |

---

## 9. Audit synchronization

Verified CREATE / UPDATE / ARCHIVE / SOFT_DELETE / RESTORE / CONFIRM / VOID / MEDIA_* có `userId`, `action`, `entity`, `entityId`, `oldValue`/`newValue` khi áp dụng, `createdAt`.

---

## 10. Security

| Test | Result |
|------|--------|
| No token | 401 |
| Invalid token | 401 |
| Unknown supabase user | 403 |
| Mass assign `createdById` / fake `actualCost` | Bị bỏ qua; actualCost=0; createdBy=admin thật |
| Cover mime sai | 400 |
| File size >10MB | 400 |
| Private media không auth | 401 |

Rate-limit stress dài: không nằm trong suite này (SKIPPED / đã có middleware).

---

## 11. Concurrency

Donation & Expense double confirm → statuses `{200, 409}`; tổng chỉ tăng một lần — **PASS**.

---

## 12. Failed tests

**0** (sau khi sửa invalidate cache).

---

## 13. Fixed issues (từ test)

Thiếu `invalidatePublicCache()` trong:

- `product.service`: `archiveProduct`, `softDeleteProduct`, `restoreProduct`
- `donation.service`: `createDonation`, `updateDonation`, `softDeleteDonation`, `restoreDonation`
- `expense.service`: `createExpense`, `updateExpense`, `softDeleteExpense`, `restoreExpense`

Triệu chứng: DB đã đổi nhưng Public list/statistics có thể trả cache cũ tới TTL 45s.

---

## 14. Remaining issues / SKIPPED

| Item | Lý do |
|------|--------|
| Playwright browser click matrix | Project chưa cài Playwright / Vitest FE |
| Rate limit soak | Không thêm test dài trong lần này |
| TanStack Query cross-tab Public live update | Public không share cache với Admin; cần F5/refetch — đúng thiết kế SPA tách session |

---

## SCENARIO checklist (yêu cầu §15)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Admin tạo sách → Public thấy | PASS |
| 2 | UPCOMING → PRINTED chuyển filter | PASS |
| 3 | Donation PENDING → total không tăng | PASS |
| 4 | CONFIRM → income + Dashboard | PASS |
| 5 | Expense CONFIRMED → actualCost + expense + balance | PASS |
| 6 | Soft delete product → Public ẩn | PASS |
| 7 | Restore → Public hiện | PASS |
| 8 | Upload cover → Storage + media + Public ảnh | PASS |
| 9 | Update → audit old/new | PASS |
| 10 | Mutation → cache invalidate | PASS |

---

## Totals

| | |
|--|--|
| **PASS** | **58 / 58** (toàn bộ `npm test`) |
| **FAIL** | **0 / 58** |
| **SKIPPED** | Browser Playwright UI matrix; rate-limit soak (ngoài Jest hiện tại) |

**Typecheck / Lint / Build:** PASS (backend + frontend; lint chỉ warning sẵn có, không fail).

---

## Cách chạy lại

```bash
cd backend
npm test
# chỉ sync:
npx jest --runInBand --forceExit tests/sync-e2e.test.ts
```
