import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import {
  designSystems,
  designSystemComponents,
  tokens,
  tenants,
  appearances,
  designSystemChanges,
} from "../../db/schema";
import {
  CreateDesignSystemSchema,
  UpdateDesignSystemSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import {
  andOptional,
  assertFound,
  designSystemBelongsToScope,
  designSystemScopeFilter,
  tryCatch,
} from "./utils";

const router = Router();

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
router.get("/:id/components", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.designSystemComponents.findMany({
      where: eq(designSystemComponents.designSystemId, req.params.id),
      with: { component: true },
    });
    res.json(rows.map((r) => r.component));
  }),
);

// GET /design-systems/:id/tokens
router.get("/:id/tokens", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(tokens)
      .where(eq(tokens.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/tenants
router.get("/:id/tenants", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
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
    const rows = await db
      .select()
      .from(designSystemChanges)
      .where(eq(designSystemChanges.designSystemId, req.params.id));
    res.json(rows);
  }),
);

export default router;
