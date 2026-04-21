import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { propertyVariations } from "../../db/schema";
import {
  CreatePropertyVariationSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(propertyVariations);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(propertyVariations)
      .where(eq(propertyVariations.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreatePropertyVariationSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(propertyVariations)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .delete(propertyVariations)
      .where(eq(propertyVariations.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
