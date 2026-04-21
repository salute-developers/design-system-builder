---
name: sync-spec
description: Sync db-service/src/openapi/spec.ts with the current DB schema and routes. Use when tables are added/removed, columns change, or route files are added/removed/changed in db-service/src/routes/api/.
---

Synchronize `db-service/src/openapi/spec.ts` with the current state of the project.

## Steps

1. Read `db-service/src/db/schema.ts` — collect all exported table names.
2. Read `db-service/src/openapi/spec.ts` — collect which tables already have a response schema (`createSelectSchema`) and which are registered in `registerCrud` / `registerPath`. Also collect all paths already registered via `registry.registerPath`.
3. Run `git diff --name-only HEAD` (or check git status) — identify which files in `db-service/src/routes/api/` were added or modified.
4. Read **every** added or modified route file in full — look for all endpoints (both CRUD and non-CRUD). Compare each endpoint's path against the paths already registered in `spec.ts`. Any missing path must be added.
5. Read `db-service/src/validation/schema.ts` — check which Create/Update schemas exist for new tables.

## Rules

### New table detected

Add in `spec.ts` in three places (in the same order as existing entries):

**1. Response schema** (after the last `createSelectSchema` block):
```typescript
const MyTableSchema = registry.register(
  "MyTable",
  createSelectSchema(tables.myTable, ts).openapi("MyTable"),
);
```
If the table has both `createdAt` and `updatedAt`, use `ts`. If the table has a timestamp column other than `createdAt`/`updatedAt`, add it to the overrides alongside `...ts`. If the table lacks `updatedAt` (e.g. append-only), omit `...ts` and list only the timestamps the table actually has (e.g. `{ publishedAt: DateTimeSchema }` or `{ createdAt: DateTimeSchema }`).

**2. Request schemas** (in the `schemas` object):
```typescript
CreateMyTable: registry.register("CreateMyTable", s.CreateMyTableSchema.openapi("CreateMyTable")),
UpdateMyTable: registry.register("UpdateMyTable", s.UpdateMyTableSchema.openapi("UpdateMyTable")),
```
Only add Update if `UpdateMyTableSchema` exists in `validation/schema.ts`.

**3. CRUD registration** (after the last `registerCrud` call for similar resources):
```typescript
registerCrud("/my-table", "My Table", MyTableSchema, schemas.CreateMyTable, schemas.UpdateMyTable);
```
Omit `updateSchema` argument if no Update schema exists.

### Removed table detected

Remove the corresponding `createSelectSchema` block, entries from `schemas`, and `registerCrud` / `registerPath` calls.

### Column added or removed

`createSelectSchema` auto-reflects column changes — no action needed unless:
- A new timestamp column was added → add override to the second arg of `createSelectSchema`.
- A column with a custom type was added → verify the generated Zod type is correct for OpenAPI.

### New unique endpoint in a route file

For every modified route file: read it in full, extract all `router.get/post/patch/delete` calls, derive the full path (prefix from `routes/index.ts` + local path), and check whether it is already registered in `spec.ts`. Add a `registry.registerPath({ ... })` block for each missing path — including non-CRUD endpoints on legacy or special routes.

Common patterns for non-CRUD endpoints:
- **Nested list** (e.g. `GET /tokens/{id}/values`): use `list(ChildSchema)` for responses
- **Nested single** (e.g. `GET /documentation-pages/by-design-system/{designSystemId}`): use `one(Schema)` for responses
- **Filter by FK** (e.g. `GET /styles/by-variation/{variationId}/by-design-system/{designSystemId}`): use `list(Schema)`, define compound `params` with `z.object({ variationId: UuidSchema, designSystemId: UuidSchema })`
- **Custom structured response** (e.g. `GET /components/{id}/deps`): define inline response schema with `z.object({ ... })`

Use the helper functions already defined in `spec.ts`: `list()`, `one()`, `created()`, `updated()`, `deleted()`, `json()`.

## Conventions

- Keep entries in the same order as tables appear in `db-service/src/db/schema.ts`.
- Table name in camelCase → `tables.myTable`; schema name → `"MyTable"`; path → `"/my-table"`.
- Tables with both `createdAt` and `updatedAt` use the `ts` shorthand (`{ createdAt: DateTimeSchema, updatedAt: DateTimeSchema }`).
- Tables with only `createdAt` use `{ createdAt: DateTimeSchema }`.
- Tables with extra timestamps (e.g. `publishedAt`) but no `updatedAt` — list only existing timestamps, without `...ts`.

## After changes

Report a summary:
- Which tables were added / removed
- Which columns changed (if relevant)
- Which unique endpoints were added
