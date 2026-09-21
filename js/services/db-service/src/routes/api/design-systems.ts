import { Request, Response, Router } from "express";
import { SQL, and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../db/index";
import {
  components,
  designSystems,
  designSystemComponents,
  styles,
  tokens,
  tenants,
  appearances,
  designSystemChanges,
  variations,
} from "../../db/schema";
import {
  CreateDesignSystemSchema,
  DesignSystemComponentParamSchema,
  TokenTypeSchema,
  UpdateDesignSystemSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import {
  andOptional,
  assertFound,
  designSystemBelongsToScope,
  designSystemScopeFilter,
  requireScope,
  tryCatch,
} from "./utils";

const router = Router();
const TOKEN_READ_SCOPE = "tokens:read";
const COMPONENT_READ_SCOPE = "components:read";

const stringQuery = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const queryLike = <T extends { name: unknown; displayName?: unknown; description?: unknown }>(
  table: T,
  query: string | undefined,
): SQL | undefined => {
  if (!query) return undefined;
  const pattern = `%${query}%`;
  const parts = [ilike(table.name as never, pattern)];
  if ("displayName" in table) parts.push(ilike(table.displayName as never, pattern));
  if ("description" in table) parts.push(ilike(table.description as never, pattern));
  return or(...parts);
};

const requireDesignSystemAccess = async (
  req: Request,
  res: Response,
): Promise<boolean> => {
  const [designSystem] = await db
    .select()
    .from(designSystems)
    .where(andOptional(eq(designSystems.id, req.params.id), designSystemScopeFilter(req as never)));

  if (!designSystem || !designSystemBelongsToScope(designSystem, req as never)) {
    res.status(404).json({ error: "Not found" });
    return false;
  }

  return true;
};

router.get("/", (req, res) =>
  tryCatch(res, async () => {
    const where = designSystemScopeFilter(req);
    const query = db.select().from(designSystems);
    const rows = where ? await query.where(where) : await query;
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(designSystems)
      .where(
        andOptional(eq(designSystems.id, req.params.id), designSystemScopeFilter(req)),
      );

    if (!assertFound(row, res)) {
      return;
    }

    if (!designSystemBelongsToScope(row, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDesignSystemSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(designSystems).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateDesignSystemSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(designSystems)
        .set(req.body)
        .where(eq(designSystems.id, req.params.id))
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
      .delete(designSystems)
      .where(eq(designSystems.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /design-systems/:id/components
router.get("/:id/components", requireScope(COMPONENT_READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;

    const where = andOptional(
      eq(designSystemComponents.designSystemId, req.params.id),
      queryLike(components, stringQuery(req.query.query)),
    );
    const rows = await db
      .select({
        id: components.id,
        name: components.name,
        description: components.description,
        createdAt: components.createdAt,
        updatedAt: components.updatedAt,
      })
      .from(designSystemComponents)
      .innerJoin(components, eq(designSystemComponents.componentId, components.id))
      .where(where);

    res.json(rows);
  }),
);

// GET /design-systems/:id/tokens
router.get("/:id/tokens", requireScope(TOKEN_READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;

    const type = stringQuery(req.query.type);
    if (type && !TokenTypeSchema.safeParse(type).success) {
      res.status(400).json({ error: `Invalid token type '${type}'` });
      return;
    }

    const rows = await db
      .select()
      .from(tokens)
      .where(
        andOptional(
          eq(tokens.designSystemId, req.params.id),
          type ? eq(tokens.type, type as never) : undefined,
          queryLike(tokens, stringQuery(req.query.query)),
        ),
      );
    res.json(rows);
  }),
);

// GET /design-systems/:id/components/:componentId/styles
router.get(
  "/:id/components/:componentId/styles",
  requireScope(COMPONENT_READ_SCOPE),
  validateParams(DesignSystemComponentParamSchema),
  (req, res) => tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;

    const component = await findDesignSystemComponent(req.params.id, req.params.componentId);
    if (!assertFound(component, res)) return;

    const componentVariations = await db
      .select({ id: variations.id })
      .from(variations)
      .where(eq(variations.componentId, component.id));
    const variationIds = componentVariations.map((row) => row.id);
    if (variationIds.length === 0) {
      res.json([]);
      return;
    }

    const rows = await db
      .select()
      .from(styles)
      .where(and(eq(styles.designSystemId, req.params.id), inArray(styles.variationId, variationIds)));
    res.json(rows);
  }),
);

// GET /design-systems/:id/tenants
router.get("/:id/tenants", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/appearances
router.get("/:id/appearances", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;
    const rows = await db
      .select()
      .from(appearances)
      .where(eq(appearances.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/changes
router.get("/:id/changes", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    if (!(await requireDesignSystemAccess(req, res))) return;
    const rows = await db
      .select()
      .from(designSystemChanges)
      .where(eq(designSystemChanges.designSystemId, req.params.id));
    res.json(rows);
  }),
);

const findDesignSystemComponent = async (designSystemId: string, componentId: string) => {
  const [row] = await db
    .select({
      id: components.id,
      name: components.name,
      description: components.description,
      createdAt: components.createdAt,
      updatedAt: components.updatedAt,
    })
    .from(designSystemComponents)
    .innerJoin(components, eq(designSystemComponents.componentId, components.id))
    .where(
      and(
        eq(designSystemComponents.designSystemId, designSystemId),
        eq(components.id, componentId),
      ),
    );
  return row;
};

export default router;
