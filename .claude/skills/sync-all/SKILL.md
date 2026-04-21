---
name: sync-all
description: Sync all db-service files after changing db-service/src/db/schema.ts or db-service/src/routes/api/ — runs sync-validation, sync-routes, sync-spec, and sync-api-types in sequence.
---

Synchronize all db-service files that depend on `db-service/src/db/schema.ts` or `db-service/src/routes/api/`.

Run the following skills in order, one after another:

1. **`/sync-validation`** — update `db-service/src/validation/schema.ts`
2. **`/sync-routes`** — create/remove route files in `db-service/src/routes/api/` and update `db-service/src/routes/index.ts`
3. **`/sync-spec`** — update `db-service/src/openapi/spec.ts`
4. **`/sync-api-types`** — regenerate `admin/src/api/openapi.json` and `admin/src/api/types.gen.ts`

After all complete, print a combined summary of everything that changed.
