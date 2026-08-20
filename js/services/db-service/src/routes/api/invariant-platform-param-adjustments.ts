import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { invariantPlatformParamAdjustments } from "../../db/schema";
import {
  CreateInvariantPlatformParamAdjustmentSchema,
  UpdateInvariantPlatformParamAdjustmentSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(invariantPlatformParamAdjustments);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(invariantPlatformParamAdjustments)
      .where(eq(invariantPlatformParamAdjustments.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateInvariantPlatformParamAdjustmentSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(invariantPlatformParamAdjustments)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateInvariantPlatformParamAdjustmentSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(invariantPlatformParamAdjustments)
        .set(req.body)
        .where(eq(invariantPlatformParamAdjustments.id, req.params.id))
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
      .delete(invariantPlatformParamAdjustments)
      .where(eq(invariantPlatformParamAdjustments.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
