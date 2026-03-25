import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { componentReuseConfigs } from "../../db/schema";
import {
  CreateComponentReuseConfigSchema,
  UpdateComponentReuseConfigSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byDepSchema = z.object({ componentDepId: z.string().uuid() });

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(componentReuseConfigs);
    res.json(rows);
  }),
);

// GET /component-reuse-configs/by-dep/:componentDepId
router.get("/by-dep/:componentDepId", validateParams(byDepSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(componentReuseConfigs)
      .where(
        eq(componentReuseConfigs.componentDepId, req.params.componentDepId),
      );
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(componentReuseConfigs)
      .where(eq(componentReuseConfigs.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateComponentReuseConfigSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(componentReuseConfigs)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateComponentReuseConfigSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(componentReuseConfigs)
        .set(req.body)
        .where(eq(componentReuseConfigs.id, req.params.id))
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
      .delete(componentReuseConfigs)
      .where(eq(componentReuseConfigs.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
