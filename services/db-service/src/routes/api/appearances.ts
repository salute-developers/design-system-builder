import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { appearances } from "../../db/schema";
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
