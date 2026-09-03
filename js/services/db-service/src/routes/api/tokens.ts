import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { tokens, tokenValues } from "../../db/schema";
import {
  CreateTokenSchema,
  UpdateTokenSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(tokens);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(tokens)
      .where(eq(tokens.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateTokenSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(tokens).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateTokenSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(tokens)
        .set(req.body)
        .where(eq(tokens.id, req.params.id))
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
      .delete(tokens)
      .where(eq(tokens.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /tokens/:id/values — all token values for a token
router.get("/:id/values", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(tokenValues)
      .where(eq(tokenValues.tokenId, req.params.id));
    res.json(rows);
  }),
);

export default router;
