import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, tokens, tokenValues } from "../../db/schema";
import {
  CreateTokenSchema,
  ModeSchema,
  PlatformSchema,
  UpdateTokenSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import {
  andOptional,
  assertFound,
  designSystemBelongsToScope,
  designSystemScopeFilter,
  getProjectId,
  isSystemAdmin,
  requireScope,
  tryCatch,
} from "./utils";

const router = Router();
const READ_SCOPE = "tokens:read";

const stringQuery = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const requireTokenAccess = async (
  token: { designSystemId: string | null },
  req: Parameters<typeof designSystemBelongsToScope>[1],
): Promise<boolean> => {
  if (isSystemAdmin(req) || !getProjectId(req)) return true;
  if (!token.designSystemId) return false;
  const [designSystem] = await db.select({ projectId: designSystems.projectId })
    .from(designSystems)
    .where(eq(designSystems.id, token.designSystemId));
  return Boolean(designSystem && designSystemBelongsToScope(designSystem, req));
};

router.get("/", (req, res) =>
  tryCatch(res, async () => {
    const scope = designSystemScopeFilter(req);
    const query = db.select().from(tokens);
    const rows = scope
      ? await query.where(
          inArray(
            tokens.designSystemId,
            db.select({ id: designSystems.id }).from(designSystems).where(scope),
          ),
        )
      : await query;
    res.json(rows);
  }),
);

router.get("/:id", requireScope(READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(tokens)
      .where(eq(tokens.id, req.params.id));

    if (!assertFound(row, res) || !(await requireTokenAccess(row, req))) {
      if (row) res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(row);
  }),
);

router.post("/", validateBody(CreateTokenSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(tokens).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateTokenSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(tokens)
        .set(req.body)
        .where(eq(tokens.id, req.params.id))
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
      .delete(tokens)
      .where(eq(tokens.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /tokens/:id/values — all token values for a token
router.get("/:id/values", requireScope(READ_SCOPE), validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [token] = await db.select().from(tokens).where(eq(tokens.id, req.params.id));
    if (!assertFound(token, res) || !(await requireTokenAccess(token, req))) {
      if (token) res.status(404).json({ error: "Not found" });
      return;
    }

    const platform = stringQuery(req.query.platform);
    if (platform && !PlatformSchema.safeParse(platform).success) {
      res.status(400).json({ error: `Invalid platform '${platform}'` });
      return;
    }
    const mode = stringQuery(req.query.mode);
    if (mode && !ModeSchema.safeParse(mode).success) {
      res.status(400).json({ error: `Invalid mode '${mode}'` });
      return;
    }
    const tenantId = stringQuery(req.query.tenantId);

    const rows = await db
      .select()
      .from(tokenValues)
      .where(andOptional(
        eq(tokenValues.tokenId, req.params.id),
        tenantId ? eq(tokenValues.tenantId, tenantId) : undefined,
        platform ? eq(tokenValues.platform, platform as never) : undefined,
        mode ? eq(tokenValues.mode, mode as never) : undefined,
      ));
    res.json(rows);
  }),
);

export default router;
