import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, tokenValues, tokens } from "../../db/schema";
import {
  CreateTokenValueSchema,
  UpdateTokenValueSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, designSystemScopeFilter, tryCatch } from "./utils";

const router = Router();

router.get("/", (req, res) =>
  tryCatch(res, async () => {
    const scope = designSystemScopeFilter(req);
    const query = db.select().from(tokenValues);
    const rows = scope
      ? await query.where(
          inArray(
            tokenValues.tokenId,
            db
              .select({ id: tokens.id })
              .from(tokens)
              .where(
                inArray(
                  tokens.designSystemId,
                  db.select({ id: designSystems.id }).from(designSystems).where(scope),
                ),
              ),
          ),
        )
      : await query;
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
