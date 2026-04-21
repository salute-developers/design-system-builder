import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { variationPlatformParamAdjustments } from "../../db/schema";
import {
  CreateVariationPlatformParamAdjustmentSchema,
  UpdateVariationPlatformParamAdjustmentSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(variationPlatformParamAdjustments);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(variationPlatformParamAdjustments)
      .where(eq(variationPlatformParamAdjustments.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateVariationPlatformParamAdjustmentSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(variationPlatformParamAdjustments)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateVariationPlatformParamAdjustmentSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(variationPlatformParamAdjustments)
        .set(req.body)
        .where(eq(variationPlatformParamAdjustments.id, req.params.id))
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
      .delete(variationPlatformParamAdjustments)
      .where(eq(variationPlatformParamAdjustments.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
