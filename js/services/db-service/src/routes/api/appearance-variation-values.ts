import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { appearanceVariationValues } from "../../db/schema";
import {
  CreateAppearanceVariationValueSchema,
  UpdateAppearanceVariationValueSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(appearanceVariationValues);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(appearanceVariationValues)
      .where(eq(appearanceVariationValues.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateAppearanceVariationValueSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(appearanceVariationValues).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateAppearanceVariationValueSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(appearanceVariationValues)
        .set(req.body)
        .where(eq(appearanceVariationValues.id, req.params.id))
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
      .delete(appearanceVariationValues)
      .where(eq(appearanceVariationValues.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
