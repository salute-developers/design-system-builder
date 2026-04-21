import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { styleCombinationMembers } from "../../db/schema";
import {
  CreateStyleCombinationMemberSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(styleCombinationMembers);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(styleCombinationMembers)
      .where(eq(styleCombinationMembers.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateStyleCombinationMemberSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(styleCombinationMembers)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .delete(styleCombinationMembers)
      .where(eq(styleCombinationMembers.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
