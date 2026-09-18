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
import {
  ownsTokenValue, ownsTokenValuePair, paletteExists, rejectMissingResource,
  requireTokenMutation, tokenActor, tokenMutationError,
} from "./token-mutation-policy";

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

router.post("/", requireTokenMutation("write"), validateBody(CreateTokenValueSchema), async (req, res) => {
  try {
    if (!(await ownsTokenValuePair(req.body.tokenId, req.body.tenantId, tokenActor(req).projectId))) {
      rejectMissingResource(res);
      return;
    }
    if (req.body.paletteId && !(await paletteExists(req.body.paletteId))) {
      res.status(400).json({ error: "Palette not found" });
      return;
    }
    const [row] = await db.insert(tokenValues).values(req.body).returning();
    res.status(201).json(row);
  } catch (error) { tokenMutationError(res, error); }
},
);

router.patch(
  "/:id",
  requireTokenMutation("write"),
  validateParams(UuidParamSchema),
  validateBody(UpdateTokenValueSchema),
  async (req, res) => {
    try {
      if (!(await ownsTokenValue(req.params.id, tokenActor(req).projectId))) {
        rejectMissingResource(res);
        return;
      }
      if (req.body.paletteId && !(await paletteExists(req.body.paletteId))) {
        res.status(400).json({ error: "Palette not found" });
        return;
      }
      const [row] = await db
        .update(tokenValues)
        .set(req.body)
        .where(eq(tokenValues.id, req.params.id))
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
    if (!(await ownsTokenValue(req.params.id, tokenActor(req).projectId))) {
      rejectMissingResource(res);
      return;
    }
    const [row] = await db
      .delete(tokenValues)
      .where(eq(tokenValues.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  } catch (error) { tokenMutationError(res, error); }
},
);

export default router;
