---
name: sync-routes
description: Sync ds-registry/src/routes/api/ and routes/index.ts with the current DB schema. Use when tables are added or removed in ds-registry/src/db/schema.ts.
---

Synchronize route files and their registration with the current state of the project.

## Steps

1. Read `ds-registry/src/db/schema.ts` — collect all exported table names.
2. Read `ds-registry/src/routes/api/` — list existing route files.
3. Read `ds-registry/src/validation/schema.ts` — check which Create/Update schemas exist.
4. Read `ds-registry/src/routes/index.ts` — check which routers are already imported and registered.
5. Diff: determine which tables have no corresponding route file.

## Rules

### New table detected (no route file)

**1. Create `ds-registry/src/routes/api/my-table.ts`**

Follow this exact structure (look at existing files for reference):

```typescript
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { myTable } from "../../db/schema";
import {
  CreateMyTableSchema,
  UpdateMyTableSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(myTable);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(myTable)
      .where(eq(myTable.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateMyTableSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(myTable).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateMyTableSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(myTable)
        .set(req.body)
        .where(eq(myTable.id, req.params.id))
        .returning();

      if (!assertFound(row, res)) {
        return;
      }

      res.json(row);
    }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .delete(myTable)
      .where(eq(myTable.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
```

**Adjustments to the template:**
- If no `UpdateMyTableSchema` exists in `validation/schema.ts` → omit the `PATCH /:id` route and its import.
- If the table is an audit log or append-only → omit `PATCH` and `DELETE`.
- If the table is a join table (no mutable fields) → omit `PATCH`.
- File name: `kebab-case` matching the table name (e.g. `design_system_users` → `design-system-users.ts`).

**2. Register in `ds-registry/src/routes/index.ts`**

Add import after the last existing api import:
```typescript
import myTableRouter from "./api/my-table";
```

Add `router.use(...)` after the last existing resource route (before the misc section):
```typescript
router.use("/my-table", myTableRouter);
```

Path: `snake_case` table name → `kebab-case` URL (e.g. `design_system_users` → `/design-system-users`).

### Removed table detected

- Delete the corresponding `routes/api/my-table.ts` file.
- Remove its import and `router.use(...)` line from `routes/index.ts`.

## Non-CRUD nested routes

Many existing route files have additional endpoints beyond standard CRUD. When creating a new route file, do **not** add nested routes automatically — only add them if explicitly requested. Examples of existing nested routes for reference:

- `GET /:id/sub-resource` — returns related entities (e.g. `GET /components/:id/variations`)
- `GET /by-foreign-key/:foreignKeyId` — filters by FK (e.g. `GET /variation-property-values/by-style/:styleId`)
- `GET /by-a/:aId/by-b/:bId` — compound filter (e.g. `GET /styles/by-variation/:variationId/by-design-system/:designSystemId`)

For nested routes with non-UUID params, use inline `z.object(...)` validation:
```typescript
const byFooSchema = z.object({ fooId: z.string().uuid() });
router.get("/by-foo/:fooId", validateParams(byFooSchema), (req, res) => ...);
```

## Conventions

- Always use `const router = Router()` and `export default router`.
- All handlers use `tryCatch(res, async () => { ... })` — never raw try/catch.
- All UUID params validated with `validateParams(UuidParamSchema)`.
- All request bodies validated with `validateBody(XxxSchema)`.
- Use `assertFound(row, res)` for single-row lookups — never inline 404 checks.
- Blank line before and after every `if` block.
- All `if` blocks use full brace form — no single-line ifs.
- Functions defined as `const` arrow functions, not `function` declarations.
- Some routes use `desc()` ordering for list endpoints (e.g. `design-system-changes`, `design-system-versions`, `saved-queries`) — apply `desc(table.createdAt)` when the table is an audit log or time-ordered.
- `optionalAuthenticate` middleware is used only in special routes (`design-systems`, `legacy`) — do not add it to standard CRUD routes.

## After changes

Report a summary:
- Which route files were created / deleted
- Which routes were registered / removed in `routes/index.ts`
