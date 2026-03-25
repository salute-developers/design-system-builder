import { Router } from "express";
import { eq, or, notInArray, inArray } from "drizzle-orm";
import { db } from "../../db/index";
import {
  designSystems,
  designSystemComponents,
  tokens,
  tenants,
  appearances,
  designSystemUsers,
  designSystemChanges,
} from "../../db/schema";
import {
  CreateDesignSystemSchema,
  UpdateDesignSystemSchema,
  UuidParamSchema,
} from "../../validation/schema";
import {
  validateBody,
  validateParams,
  optionalAuthenticate,
} from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";

const router = Router();

router.get("/", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const hasAuthHeader = req.headers.authorization?.startsWith("Basic ");

    // 1. No Authorization header — return all (admin mode)
    if (!hasAuthHeader) {
      const rows = await db.select().from(designSystems);
      res.json(rows);
      return;
    }

    // All design system IDs that have at least one assigned user
    const assignedDsIds = (
      await db
        .select({ id: designSystemUsers.designSystemId })
        .from(designSystemUsers)
    ).map((r) => r.id);

    // 2. Invalid token — only unassigned design systems
    if (!req.user) {
      const rows =
        assignedDsIds.length > 0
          ? await db
              .select()
              .from(designSystems)
              .where(notInArray(designSystems.id, assignedDsIds))
          : await db.select().from(designSystems);
      res.json(rows);
      return;
    }

    // 3. Valid user — assigned to user + unassigned
    const userId = req.user.id;

    const userDsIds = (
      await db
        .select({ id: designSystemUsers.designSystemId })
        .from(designSystemUsers)
        .where(eq(designSystemUsers.userId, userId))
    ).map((r) => r.id);

    let rows;

    if (assignedDsIds.length === 0) {
      rows = await db.select().from(designSystems);
    } else if (userDsIds.length > 0) {
      rows = await db
        .select()
        .from(designSystems)
        .where(
          or(
            inArray(designSystems.id, userDsIds),
            notInArray(designSystems.id, assignedDsIds),
          ),
        );
    } else {
      rows = await db
        .select()
        .from(designSystems)
        .where(notInArray(designSystems.id, assignedDsIds));
    }

    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateDesignSystemSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(designSystems).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateDesignSystemSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(designSystems)
        .set(req.body)
        .where(eq(designSystems.id, req.params.id))
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
      .delete(designSystems)
      .where(eq(designSystems.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /design-systems/:id/components
router.get("/:id/components", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.designSystemComponents.findMany({
      where: eq(designSystemComponents.designSystemId, req.params.id),
      with: { component: true },
    });
    res.json(rows.map((r) => r.component));
  }),
);

// GET /design-systems/:id/tokens
router.get("/:id/tokens", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(tokens)
      .where(eq(tokens.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/tenants
router.get("/:id/tenants", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/appearances
router.get("/:id/appearances", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(appearances)
      .where(eq(appearances.designSystemId, req.params.id));
    res.json(rows);
  }),
);

// GET /design-systems/:id/users
router.get("/:id/users", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db.query.designSystemUsers.findMany({
      where: eq(designSystemUsers.designSystemId, req.params.id),
      with: { user: true },
    });
    res.json(rows.map((r) => r.user));
  }),
);

// GET /design-systems/:id/changes
router.get("/:id/changes", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select()
      .from(designSystemChanges)
      .where(eq(designSystemChanges.designSystemId, req.params.id));
    res.json(rows);
  }),
);

export default router;
