import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, client } from "../../db/index";
import { savedQueries } from "../../db/schema";
import {
  CreateSavedQuerySchema,
  UpdateSavedQuerySchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(savedQueries)
      .orderBy(desc(savedQueries.createdAt));
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateSavedQuerySchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(savedQueries).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateSavedQuerySchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(savedQueries)
        .set(req.body)
        .where(eq(savedQueries.id, req.params.id))
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
      .delete(savedQueries)
      .where(eq(savedQueries.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /saved-queries/:id/run — execute the query
router.get("/:id/run", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [entry] = await db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.id, req.params.id));

    if (!assertFound(entry, res)) {
      return;
    }

    const rows = await client.unsafe(entry.sql);
    res.json({
      id: entry.id,
      label: entry.label,
      result: rows,
      count: rows.length,
    });
  }),
);

export default router;
