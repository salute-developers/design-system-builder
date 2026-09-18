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
import {
  ownsToken, ownsTokenDesignSystem, rejectMissingResource, requireTokenMutation,
  tokenActor, tokenMutationError,
} from "./token-mutation-policy";

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

router.post("/", requireTokenMutation("write"), validateBody(CreateTokenSchema), async (req, res) => {
  try {
    if (!(await ownsTokenDesignSystem(req.body.designSystemId, tokenActor(req).projectId))) {
      rejectMissingResource(res);
      return;
    }
    const [row] = await db.insert(tokens).values(req.body).returning();
    res.status(201).json(row);
  } catch (error) { tokenMutationError(res, error); }
},
);

router.patch(
  "/:id",
  requireTokenMutation("write"),
  validateParams(UuidParamSchema),
  validateBody(UpdateTokenSchema),
  async (req, res) => {
    try {
      if (!(await ownsToken(req.params.id, tokenActor(req).projectId))) {
        rejectMissingResource(res);
        return;
      }
      const [row] = await db
        .update(tokens)
        .set(req.body)
        .where(eq(tokens.id, req.params.id))
        .returning();

      if (!assertFound(row, res)) {
        return;
      }

      res.json(row);
    } catch (error) { tokenMutationError(res, error); }
  },
);

router.delete("/:id", requireTokenMutation("delete"), validateParams(UuidParamSchema), async (req, res) => {
  try {
    if (!(await ownsToken(req.params.id, tokenActor(req).projectId))) {
      rejectMissingResource(res);
      return;
    }
    const [row] = await db
      .delete(tokens)
      .where(eq(tokens.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  } catch (error) { tokenMutationError(res, error); }
},
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
