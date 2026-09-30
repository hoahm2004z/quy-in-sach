# Tiến độ triển khai

Xem báo cáo bàn giao đầy đủ cho AI/dev tiếp theo:

**→ [`docs/HANDOFF-CHATGPT.md`](./HANDOFF-CHATGPT.md)**

## Đã hoàn thành

| Phase | Nội dung | Kiểm tra |
|------|----------|----------|
| 1–8 | Backend API core | PASS |
| 9 | Public Frontend | PASS |
| 10 | Admin Frontend (+ companions/audit/trash API) | PASS |
| 11 | Media / Storage (signed upload, cover/proof/invoice) | PASS (36 tests) |
| — | Soft-delete UI khoản thu/chi PENDING | PASS |

## Việc tiếp theo

- Auth production (Supabase Auth, tắt `ALLOW_DEV_LOGIN`)
- Phase 13–15: hardening, full tests, Docker/Nginx deploy
