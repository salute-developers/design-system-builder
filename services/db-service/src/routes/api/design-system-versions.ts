import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { designSystemVersions } from "../../db/schema";
import {
  CreateDesignSystemVersionSchema,
  UpdateDesignSystemVersionSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byDesignSystemSchema = z.object({ designSystemId: z.string().uuid() });

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(designSystemVersions)
      .orderBy(desc(designSystemVersions.publishedAt));
    res.json(rows);
  }),
);

// GET /design-system-versions/by-design-system/:designSystemId — all versions for a DS
router.get(
  "/by-design-system/:designSystemId",
  validateParams(byDesignSystemSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const rows = await db
        .select()
        .from(designSystemVersions)
        .where(
          eq(designSystemVersions.designSystemId, req.params.designSystemId),
        )
        .orderBy(desc(designSystemVersions.publishedAt));
      res.json(rows);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(designSystemVersions)
      .where(eq(designSystemVersions.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDesignSystemVersionSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(designSystemVersions)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateDesignSystemVersionSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(designSystemVersions)
        .set(req.body)
        .where(eq(designSystemVersions.id, req.params.id))
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
      .delete(designSystemVersions)
      .where(eq(designSystemVersions.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
