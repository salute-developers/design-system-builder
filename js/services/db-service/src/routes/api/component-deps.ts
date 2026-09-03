import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { componentDeps } from "../../db/schema";
import {
  CreateComponentDepSchema,
  UpdateComponentDepSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(componentDeps);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(componentDeps)
      .where(eq(componentDeps.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateComponentDepSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(componentDeps).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateComponentDepSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(componentDeps)
        .set(req.body)
        .where(eq(componentDeps.id, req.params.id))
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
      .delete(componentDeps)
      .where(eq(componentDeps.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
