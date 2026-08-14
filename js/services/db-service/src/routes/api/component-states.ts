import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { componentStates } from "../../db/schema";
import { UuidParamSchema } from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";
import { z } from "zod";

const CreateComponentStateSchema = z.object({
  componentId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});

const UpdateComponentStateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    res.json(await db.select().from(componentStates));
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.select().from(componentStates).where(eq(componentStates.id, req.params.id));
    if (!assertFound(row, res)) return;
    res.json(row);
  }),
);

router.post("/", validateBody(CreateComponentStateSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(componentStates).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch("/:id", validateParams(UuidParamSchema), validateBody(UpdateComponentStateSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .update(componentStates)
      .set(req.body)
      .where(eq(componentStates.id, req.params.id))
      .returning();
    if (!assertFound(row, res)) return;
    res.json(row);
  }),
);

router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.delete(componentStates).where(eq(componentStates.id, req.params.id)).returning();
    if (!assertFound(row, res)) return;
    res.json({ ok: true });
  }),
);

export default router;
