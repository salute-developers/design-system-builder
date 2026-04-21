import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { designSystemChanges } from "../../db/schema";
import {
  CreateDesignSystemChangeSchema,
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
      .from(designSystemChanges)
      .orderBy(desc(designSystemChanges.createdAt));
    res.json(rows);
  }),
);

// GET /design-system-changes/by-design-system/:designSystemId
router.get(
  "/by-design-system/:designSystemId",
  validateParams(byDesignSystemSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const rows = await db
        .select()
        .from(designSystemChanges)
        .where(
          eq(designSystemChanges.designSystemId, req.params.designSystemId),
        )
        .orderBy(desc(designSystemChanges.createdAt));
      res.json(rows);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(designSystemChanges)
      .where(eq(designSystemChanges.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDesignSystemChangeSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(designSystemChanges)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

export default router;
