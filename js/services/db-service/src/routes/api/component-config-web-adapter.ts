import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { designSystems } from "../../db/schema";
import { validateBody } from "../../validation/middleware";
import { buildWebAdapter } from "../../db/export/webAdapter";
import { andOptional, designSystemBelongsToScope, designSystemScopeFilter, requireScope, tryCatch } from "./utils";

const READ_SCOPE = "components:read";

export const WebAdapterRequestSchema = z.object({
  designSystemId: z.string().uuid(),
});

const router = Router();

/**
 * Web-адаптер: шаблоны web-параметров, compose-связи, имена и описания компонентов.
 *
 * Временная ручка рядом с `/export`: адресация та же, а ответ CLI сохраняет как есть
 * в `.sdds/web/web-adapter.json`. В общий ответ выгрузки эти данные не входят, чтобы
 * временное решение не расширяло формат, общий для платформ.
 */
router.post("/web-adapter", requireScope(READ_SCOPE), validateBody(WebAdapterRequestSchema), (req, res) =>
  tryCatch(res, async () => {
    const { designSystemId } = req.body as z.infer<typeof WebAdapterRequestSchema>;

    const [designSystem] = await db
      .select()
      .from(designSystems)
      .where(andOptional(eq(designSystems.id, designSystemId), designSystemScopeFilter(req)));

    if (!designSystem || !designSystemBelongsToScope(designSystem, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(await buildWebAdapter(db, designSystem.id));
  }),
);

export default router;
