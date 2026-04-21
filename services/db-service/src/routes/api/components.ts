import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import {
  components,
  variations,
  properties,
  componentDeps,
} from "../../db/schema";
import {
  CreateComponentSchema,
  UpdateComponentSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(components);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(components)
      .where(eq(components.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateComponentSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(components).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateComponentSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(components)
        .set(req.body)
        .where(eq(components.id, req.params.id))
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
      .delete(components)
      .where(eq(components.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /components/:id/variations
router.get("/:id/variations", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(variations)
      .where(eq(variations.componentId, req.params.id));
    res.json(rows);
  }),
);

// GET /components/:id/properties
router.get("/:id/properties", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(properties)
      .where(eq(properties.componentId, req.params.id));
    res.json(rows);
  }),
);

// GET /components/:id/deps — parent and child deps
router.get("/:id/deps", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const asParent = await db.query.componentDeps.findMany({
      where: eq(componentDeps.parentId, req.params.id),
      with: { child: true },
    });
    const asChild = await db.query.componentDeps.findMany({
      where: eq(componentDeps.childId, req.params.id),
      with: { parent: true },
    });
    res.json({ asParent, asChild });
  }),
);

export default router;
