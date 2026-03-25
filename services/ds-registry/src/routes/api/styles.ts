import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { styles } from "../../db/schema";
import {
  CreateStyleSchema,
  UpdateStyleSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

const byVariationAndDsSchema = z.object({
  variationId: z.string().uuid(),
  designSystemId: z.string().uuid(),
});

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(styles);
    res.json(rows);
  }),
);

// GET /styles/by-variation/:variationId/by-design-system/:designSystemId
router.get(
  "/by-variation/:variationId/by-design-system/:designSystemId",
  validateParams(byVariationAndDsSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const rows = await db
        .select()
        .from(styles)
        .where(
          and(
            eq(styles.variationId, req.params.variationId),
            eq(styles.designSystemId, req.params.designSystemId),
          ),
        );
      res.json(rows);
    }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(styles)
      .where(eq(styles.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateStyleSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(styles).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateStyleSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(styles)
        .set(req.body)
        .where(eq(styles.id, req.params.id))
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
      .delete(styles)
      .where(eq(styles.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
