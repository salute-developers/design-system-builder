import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { appearanceVariations } from "../../db/schema";
import {
  CreateAppearanceVariationSchema,
  UpdateAppearanceVariationSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(appearanceVariations);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(appearanceVariations)
      .where(eq(appearanceVariations.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateAppearanceVariationSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(appearanceVariations).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateAppearanceVariationSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(appearanceVariations)
        .set(req.body)
        .where(eq(appearanceVariations.id, req.params.id))
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
      .delete(appearanceVariations)
      .where(eq(appearanceVariations.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
