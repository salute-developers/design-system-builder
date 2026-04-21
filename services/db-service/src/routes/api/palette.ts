import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { palette } from "../../db/schema";
import {
  CreatePaletteSchema,
  UpdatePaletteSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(palette);
    res.json(rows);
  }),
);

// GET /palette/by-type/:type — filter by general or additional
router.get("/by-type/:type", (req, res) => {
  const type = req.params.type;

  if (type !== "general" && type !== "additional") {
    res.status(400).json({ error: "Type must be general or additional" });
    return;
  }

  return tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(palette)
      .where(eq(palette.type, type as "general" | "additional"));
    res.json(rows);
  });
});

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(palette)
      .where(eq(palette.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreatePaletteSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(palette).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdatePaletteSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(palette)
        .set(req.body)
        .where(eq(palette.id, req.params.id))
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
      .delete(palette)
      .where(eq(palette.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

export default router;
