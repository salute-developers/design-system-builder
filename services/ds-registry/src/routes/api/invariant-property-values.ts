import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { invariantPropertyValues } from "../../db/schema";
import {
  CreateInvariantPropertyValueSchema,
  UpdateInvariantPropertyValueSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byComponentAndDsSchema = z.object({
  componentId: z.string().uuid(),
  designSystemId: z.string().uuid(),
});

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(invariantPropertyValues);
    res.json(rows);
  }),
);

// GET /invariant-property-values/by-component/:componentId/by-design-system/:designSystemId
router.get(
  "/by-component/:componentId/by-design-system/:designSystemId",
  validateParams(byComponentAndDsSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const rows = await db
        .select()
        .from(invariantPropertyValues)
        .where(
          and(
            eq(invariantPropertyValues.componentId, req.params.componentId),
            eq(
              invariantPropertyValues.designSystemId,
              req.params.designSystemId,
            ),
          ),
        );
      res.json(rows);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(invariantPropertyValues)
      .where(eq(invariantPropertyValues.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateInvariantPropertyValueSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(invariantPropertyValues)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateInvariantPropertyValueSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(invariantPropertyValues)
        .set(req.body)
        .where(eq(invariantPropertyValues.id, req.params.id))
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
      .delete(invariantPropertyValues)
      .where(eq(invariantPropertyValues.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
