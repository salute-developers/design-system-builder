import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { propertyValueStates } from "../../db/schema";
import {
  CreatePropertyValueStateSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(propertyValueStates);
    res.json(rows);
  }),
);

/**
 * Состояния, при которых действует значение вариации.
 *
 * Нужна копированию дизайн-системы: значение переносится вместе с ключом набора,
 * а связи создаются заново по этому перечню.
 */
router.get("/by-variation-value/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(propertyValueStates)
      .where(eq(propertyValueStates.variationPropertyValueId, req.params.id));

    res.json(rows);
  }),
);

/**
 * То же для инвариантного значения.
 */
router.get("/by-invariant-value/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(propertyValueStates)
      .where(eq(propertyValueStates.invariantPropertyValueId, req.params.id));

    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(propertyValueStates)
      .where(eq(propertyValueStates.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreatePropertyValueStateSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(propertyValueStates)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .delete(propertyValueStates)
      .where(eq(propertyValueStates.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
