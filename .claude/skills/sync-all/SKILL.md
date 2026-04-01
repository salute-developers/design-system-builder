---
name: sync-all
description: Sync all ds-registry files after changing ds-registry/src/db/schema.ts or ds-registry/src/routes/api/ — runs sync-validation, sync-routes, sync-spec, and sync-api-types in sequence.
---

Synchronize all ds-registry files that depend on `ds-registry/src/db/schema.ts` or `ds-registry/src/routes/api/`.

Run the following skills in order, one after another:

1. **`/sync-validation`** — update `ds-registry/src/validation/schema.ts`
2. **`/sync-routes`** — create/remove route files in `ds-registry/src/routes/api/` and update `ds-registry/src/routes/index.ts`
3. **`/sync-spec`** — update `ds-registry/src/openapi/spec.ts`
4. **`/sync-api-types`** — regenerate `admin/src/api/openapi.json` and `admin/src/api/types.gen.ts`

After all complete, print a combined summary of everything that changed.
