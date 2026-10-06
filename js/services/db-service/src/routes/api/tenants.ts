import { Router } from "express";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, palette, tenants, tokenValues } from "../../db/schema";
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, getProjectId, isSystemAdmin, requireScope, tryCatch } from "./utils";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    const rows = await db.select().from(tenants);
    res.json(rows);
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, req.params.id));

    if (!assertFound(row, res)) {
      return;
    }

    res.json(row);
  }),
);

router.post("/", requireScope("tenants:write"), validateBody(CreateTenantSchema), (req, res) =>
  tryCatch(res, async () => {
    const projectId = getProjectId(req);
    if (projectId && !isSystemAdmin(req)) {
      const [designSystem] = await db.select({ projectId: designSystems.projectId })
        .from(designSystems).where(eq(designSystems.id, req.body.designSystemId));
      if (!designSystem || designSystem.projectId !== projectId) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (!["owner", "maintainer", "editor"].includes(String(req.headers["x-project-role"] || ""))) {
        res.status(403).json({ error: "Insufficient project role" });
        return;
      }
    }
    const [row] = await db.insert(tenants).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch(
  "/:id",
  validateParams(UuidParamSchema),
  validateBody(UpdateTenantSchema),
  (req, res) =>
    tryCatch(res, async () => {
      const [row] = await db
        .update(tenants)
        .set(req.body)
        .where(eq(tenants.id, req.params.id))
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
      .delete(tenants)
      .where(eq(tenants.id, req.params.id))
      .returning();

    if (!assertFound(row, res)) {
      return;
    }

    res.json({ ok: true });
  }),
);

// GET /tenants/:id/token-values — all token values for a tenant
router.get("/:id/token-values", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const rows = await db
      .select({
        ...getTableColumns(tokenValues),
        paletteType: palette.type,
        paletteShade: palette.shade,
        paletteSaturation: palette.saturation,
      })
      .from(tokenValues)
      .leftJoin(palette, eq(tokenValues.paletteId, palette.id))
      .where(eq(tokenValues.tenantId, req.params.id));

    // Значения, хранимые ссылкой на палитру, отдаём строкой "[type.shade.saturation]",
    // а value такой строки содержит только альфу. Потребители раскрывают ссылку по локальной палитре.
    res.json(
      rows.map(({ paletteType, paletteShade, paletteSaturation, ...row }) => {
        if (!row.paletteId || paletteType === null) {
          return row;
        }
        const ref = `[${paletteType}.${paletteShade}.${paletteSaturation}]`;
        const alpha = (row.value as unknown[] | null)?.[0] ?? null;
        return { ...row, value: [alpha === null ? ref : `${ref}[${alpha}]`] };
      }),
    );
  }),
);

export default router;
