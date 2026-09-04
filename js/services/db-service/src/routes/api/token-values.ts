import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { tokenValues } from "../../db/schema";
import {
  CreateTokenValueSchema,
  UpdateTokenValueSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(tokenValues);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(tokenValues)
      .where(eq(tokenValues.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateTokenValueSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(tokenValues).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateTokenValueSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(tokenValues)
        .set(req.body)
        .where(eq(tokenValues.id, req.params.id))
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
      .delete(tokenValues)
      .where(eq(tokenValues.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
