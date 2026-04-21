import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { users, designSystemUsers } from "../../db/schema";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(users);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateUserSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(users).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateUserSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(users)
        .set(req.body)
        .where(eq(users.id, req.params.id))
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
      .delete(users)
      .where(eq(users.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /users/:id/design-systems — get design systems for a user
router.get("/:id/design-systems", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.designSystemUsers.findMany({
      where: eq(designSystemUsers.userId, req.params.id),
      with: { designSystem: true },
    });
    res.json(rows.map((r) => r.designSystem));
  }),
);

export default router;
