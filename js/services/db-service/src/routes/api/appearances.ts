import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index";
import { appearanceVariationValues, appearanceVariations, appearances } from "../../db/schema";
import {
  CreateAppearanceSchema,
  UpdateAppearanceSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(appearances);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(appearances)
      .where(eq(appearances.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

/**
 * Объявление осей вариаций этого appearance вместе с их значениями.
 *
 * Отдельная ручка, а не выборка из общего списка: копирование дизайн-системы переносит
 * объявления по одному appearance, и тянуть ради этого все объявления базы, чтобы отфильтровать
 * их на клиенте, значит возить мегабайты ради десятка строк.
 */
router.get("/:id/variations", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const axes = await db
      .select()
      .from(appearanceVariations)
      .where(eq(appearanceVariations.appearanceId, req.params.id))
      .orderBy(appearanceVariations.position);

    if (axes.length === 0) {
      res.json([]);
      return;
    }

    const values = await db
      .select()
      .from(appearanceVariationValues)
      .where(
        inArray(
          appearanceVariationValues.appearanceVariationId,
          axes.map((axis) => axis.id),
        ),
      )
      .orderBy(appearanceVariationValues.position);

    res.json(
      axes.map((axis) => ({
        ...axis,
        values: values.filter((value) => value.appearanceVariationId === axis.id),
      })),
    );
  }),
);

router.post("/", validateBody(CreateAppearanceSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(appearances).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateAppearanceSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(appearances)
        .set(req.body)
        .where(eq(appearances.id, req.params.id))
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
      .delete(appearances)
      .where(eq(appearances.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
