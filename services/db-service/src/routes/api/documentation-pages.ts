import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { documentationPages } from "../../db/schema";
import {
  CreateDocumentationPageSchema,
  UpdateDocumentationPageSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byDesignSystemSchema = z.object({ designSystemId: z.string().uuid() });

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(documentationPages);
    res.json(rows);
  }),
);

// GET /documentation-pages/by-design-system/:designSystemId
router.get(
  "/by-design-system/:designSystemId",
  validateParams(byDesignSystemSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .select()
        .from(documentationPages)
        .where(
          eq(documentationPages.designSystemId, req.params.designSystemId),
        );

      if (!assertFound(row, res)) {
        return;
      }

      res.json(row);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(documentationPages)
      .where(eq(documentationPages.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDocumentationPageSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(documentationPages)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateDocumentationPageSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(documentationPages)
        .set(req.body)
        .where(eq(documentationPages.id, req.params.id))
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
      .delete(documentationPages)
      .where(eq(documentationPages.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
