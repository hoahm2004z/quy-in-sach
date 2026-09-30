# Phase 1 — Database

## Models

users, products, donations, expenses, companions, media, audit_logs, settings

## Notes

- `actual_cost` is **not** a column on `products`; it is derived from confirmed expenses.
- Financial FKs use `onDelete: Restrict` so product soft-delete/archive never cascade-deletes money history.
- Soft-delete fields on business entities: `deleted_at`, `deleted_by`, `delete_reason`.
- Local Postgres via Docker on host port **5433**.
