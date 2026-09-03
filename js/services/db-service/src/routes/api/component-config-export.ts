import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems } from "../../db/schema";
import { ExportRequest, ExportRequestSchema } from "../../db/import/commonConfig";
import { validateBody } from "../../validation/middleware";
import { buildComponentPackage } from "../../db/export/componentExport";
import {
  andOptional,
  designSystemBelongsToScope,
  designSystemScopeFilter,
  requireScope,
  tryCatch,
} from "./utils";

const READ_SCOPE = "components:read";

const router = Router();

/**
 * Выгружает конфигурации компонентов дизайн-системы одним ответом.
 *
 * Зеркало `/import`: тот же путь, `POST`, адресация телом. Существующий
 * `GET /ds/component-config` отдаёт один конфиг за запрос и адресует дизайн-систему именем;
 * для пакета из полутора сотен конфигураций это столько же запросов, каждый из которых
 * делает около десяти обращений в базу.
 */
router.post("/export", requireScope(READ_SCOPE), validateBody(ExportRequestSchema), (req, res) =>
  tryCatch(res, async () => {
    const request: ExportRequest = req.body;

    const [designSystem] = await db
      .select()
      .from(designSystems)
      .where(andOptional(eq(designSystems.id, request.designSystemId), designSystemScopeFilter(req)));

    if (!designSystem || !designSystemBelongsToScope(designSystem, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const result = await buildComponentPackage(db, designSystem);
    if (!result.ok) {
      res.status(422).json({ error: "Export failed", message: result.reason });
      return;
    }

    res.json(result.package);
  }),
);

export default router;
