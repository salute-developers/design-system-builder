---
name: sync-validation
description: Sync db-service/src/validation/schema.ts with the current DB schema. Use when tables are added/removed or columns change in db-service/src/db/schema.ts.
---

Synchronize `db-service/src/validation/schema.ts` with the current state of `db-service/src/db/schema.ts`.

## Steps

1. Read `db-service/src/db/schema.ts` — collect all exported tables and their columns.
2. Read `db-service/src/validation/schema.ts` — collect existing Create/Update schemas and exported types.
3. Diff: determine what was added, removed, or changed.

## Rules

### New table detected

Add three blocks in `validation/schema.ts` (after the last schema block for a similar table):

**1. Create schema** — include all non-auto fields (exclude `id`, `createdAt`, `updatedAt`):
```typescript
// My Table
export const CreateMyTableSchema = z.object({
  requiredField: z.string().trim().min(1).max(255),
  optionalField: z.string().trim().max(1000).optional(),
  foreignKeyId: uuidSchema,
  enumField: MyEnumSchema,
});
```

**2. Update schema** — all fields optional, only fields that make sense to update (exclude FKs that define identity):
```typescript
export const UpdateMyTableSchema = z.object({
  requiredField: z.string().trim().min(1).max(255).optional(),
  optionalField: z.string().trim().max(1000).optional(),
});
```
Omit Update schema if the table is append-only (e.g. audit log, join table with no mutable fields).

**3. Exported types** (at the bottom of the file):
```typescript
export type CreateMyTableRequest = z.infer<typeof CreateMyTableSchema>;
export type UpdateMyTableRequest = z.infer<typeof UpdateMyTableSchema>;
```

### Removed table detected

Remove the corresponding Create/Update schemas and their exported types.

### Column added to existing table

- If the column is required (`notNull` without default) → add as required field in Create schema.
- If the column has a default or is nullable → add as `.optional()` in Create schema; add `.optional()` in Update schema if it makes sense to update it.
- If the column is a generated/computed field → do not add to any schema.

### Column removed from existing table

Remove the field from Create and Update schemas, and from exported types if the type became empty.

### Column type changed

Update the Zod type accordingly:
- `text` → `z.string()`
- `integer` → `z.number().int()`
- `boolean` → `z.boolean()`
- `jsonb` → `z.any()` unless the column has a `$type<...>()` annotation in the schema — in that case, create a Zod schema matching the TypeScript type (see `ColorConfigSchema` / `CreateTenantSchema` for an example)
- `uuid` FK → `uuidSchema` (local const, not exported)
- `pgEnum` → use the corresponding `XxxSchema` enum already defined in this file (or add a new one if the enum is new)

### New pgEnum detected

Add a new enum schema near the top of the file (after existing enum schemas):
```typescript
export const MyEnumSchema = z.enum(["value1", "value2"]);
```

### Removed pgEnum detected

Remove the corresponding `z.enum(...)` export and all usages of it in this file.

## Conventions

- File starts with `import "../zod-extend";` and `import { z } from "zod";`.
- All UUID foreign keys use the local `uuidSchema` (not exported, defined at top of file).
- String fields: use `.trim()`, set reasonable `.max()` (255 for names, 1000 for descriptions, 50 for versions/codes).
- Join tables (no mutable fields beyond FKs) → Create schema only, no Update schema.
- Append-only tables (e.g. audit log, tables without `updatedAt`) → Create schema only.
- Keep section comments like `// My Table` consistent with existing style.
- Keep exported types block at the bottom in the same order as schemas above.
- Enum schemas are declared at the top of the file (after imports), before any table schemas.
- Common param schemas (`UuidParamSchema`, `PaginationQuerySchema`) live after enum schemas, before table schemas.

## After changes

Report a summary:
- Which tables were added / removed
- Which columns changed (and which schemas were updated)
- Which enums were added / removed
