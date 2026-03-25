import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystemUsers } from "../../db/schema";
import {
  CreateDesignSystemUserSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(designSystemUsers);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(designSystemUsers)
      .where(eq(designSystemUsers.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDesignSystemUserSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(designSystemUsers)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .delete(designSystemUsers)
      .where(eq(designSystemUsers.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
