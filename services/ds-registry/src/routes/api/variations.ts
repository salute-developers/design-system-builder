import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { variations, styles, propertyVariations } from "../../db/schema";
import {
  CreateVariationSchema,
  UpdateVariationSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(variations);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(variations)
      .where(eq(variations.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateVariationSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(variations).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateVariationSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(variations)
        .set(req.body)
        .where(eq(variations.id, req.params.id))
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
      .delete(variations)
      .where(eq(variations.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /variations/:id/styles — styles for a variation across all design systems
router.get("/:id/styles", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(styles)
      .where(eq(styles.variationId, req.params.id));
    res.json(rows);
  }),
);

// GET /variations/:id/properties — properties linked via property_variations
router.get("/:id/properties", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.propertyVariations.findMany({
      where: eq(propertyVariations.variationId, req.params.id),
      with: { property: true },
    });
    res.json(rows.map((r) => r.property));
  }),
);

export default router;
