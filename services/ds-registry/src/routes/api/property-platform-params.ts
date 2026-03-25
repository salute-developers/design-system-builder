import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { propertyPlatformParams } from "../../db/schema";
import {
  CreatePropertyPlatformParamSchema,
  UpdatePropertyPlatformParamSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(propertyPlatformParams);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(propertyPlatformParams)
      .where(eq(propertyPlatformParams.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreatePropertyPlatformParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .insert(propertyPlatformParams)
      .values(req.body)
      .returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdatePropertyPlatformParamSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(propertyPlatformParams)
        .set(req.body)
        .where(eq(propertyPlatformParams.id, req.params.id))
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
      .delete(propertyPlatformParams)
      .where(eq(propertyPlatformParams.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
