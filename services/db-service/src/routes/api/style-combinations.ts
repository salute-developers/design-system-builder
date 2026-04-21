import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { styleCombinations, styleCombinationMembers } from "../../db/schema";
import {
  CreateStyleCombinationSchema,
  UpdateStyleCombinationSchema,
  CreateStyleCombinationMemberSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(styleCombinations);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(styleCombinations)
      .where(eq(styleCombinations.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateStyleCombinationSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(styleCombinations)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateStyleCombinationSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(styleCombinations)
        .set(req.body)
        .where(eq(styleCombinations.id, req.params.id))
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
      .delete(styleCombinations)
      .where(eq(styleCombinations.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /style-combinations/:id/members
router.get("/:id/members", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.styleCombinationMembers.findMany({
      where: eq(styleCombinationMembers.combinationId, req.params.id),
      with: { style: true },
    });
    res.json(rows);
  }),
);

// POST /style-combinations/:id/members — add a style to a combination
router.post(
  "/:id/members",
  validateParams(UuidParamSchema),
  validateBody(CreateStyleCombinationMemberSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .insert(styleCombinationMembers)
        .values({ ...req.body, combinationId: req.params.id })
        .returning();
      res.status(201).json(row);
    }),
);

export default router;
