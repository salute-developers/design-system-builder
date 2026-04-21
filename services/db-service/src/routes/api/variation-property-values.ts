import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { variationPropertyValues } from "../../db/schema";
import {
  CreateVariationPropertyValueSchema,
  UpdateVariationPropertyValueSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byStyleSchema = z.object({ styleId: z.string().uuid() });
const byAppearanceSchema = z.object({ appearanceId: z.string().uuid() });

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(variationPropertyValues);
    res.json(rows);
  }),
);

// GET /variation-property-values/by-style/:styleId
router.get("/by-style/:styleId", validateParams(byStyleSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(variationPropertyValues)
      .where(eq(variationPropertyValues.styleId, req.params.styleId));
    res.json(rows);
  }),
);

// GET /variation-property-values/by-appearance/:appearanceId
router.get(
  "/by-appearance/:appearanceId",
  validateParams(byAppearanceSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const rows = await db
        .select()
        .from(variationPropertyValues)
        .where(
          eq(variationPropertyValues.appearanceId, req.params.appearanceId),
        );
      res.json(rows);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(variationPropertyValues)
      .where(eq(variationPropertyValues.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateVariationPropertyValueSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(variationPropertyValues)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateVariationPropertyValueSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(variationPropertyValues)
        .set(req.body)
        .where(eq(variationPropertyValues.id, req.params.id))
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
      .delete(variationPropertyValues)
      .where(eq(variationPropertyValues.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
