import { NextFunction, Request, Response, Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, designSystemChanges } from "../../db/schema";
import { ImportRequest, ImportRequestSchema } from "../../db/import/commonConfig";
import { validateBody } from "../../validation/middleware";
import { importComponents } from "../../db/import/componentImport";
import { andOptional, designSystemScopeFilter, designSystemBelongsToScope, isSystemAdmin, tryCatch } from "./utils";

const WRITE_SCOPE = "components:write";

/**
 * Признак отката транзакции для режима dry run: работа выполняется целиком, затем
 * откатывается, поэтому план совпадает с тем, что произойдёт при применении.
 */
class DryRunRollback extends Error {
  constructor(public readonly payload: unknown) {
    super("dry run");
  }
}

const headerValue = (req: Request, name: string): string | undefined => {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
};

/**
 * Проверяет write-scope. Ключ проекта приходит со списком scope в заголовке от gateway;
 * системный администратор и запросы без project-контекста проверке не подлежат.
 */
const hasWriteScope = (req: Request): boolean => {
  if (isSystemAdmin(req)) return true;

  const raw = headerValue(req, "x-project-scopes");
  if (raw === undefined) return true;

  return raw
    .split(",")
    .map((scope) => scope.trim())
    .includes(WRITE_SCOPE);
};

/**
 * Отклоняет запрос без write-scope до разбора тела: пакет компонентов весит мегабайты,
 * и проверять его для запроса, которому в любом случае отказано, незачем.
 */
const requireWriteScope = (req: Request, res: Response, next: NextFunction): void => {
  if (!hasWriteScope(req)) {
    res.status(403).json({ error: `Scope '${WRITE_SCOPE}' is required` });
    return;
  }
  next();
};

const router = Router();

/**
 * Загружает пакет конфигураций компонентов в дизайн-систему одним запросом.
 *
 * Дизайн-система адресуется полем `designSystemId` тела: путь остаётся без параметров,
 * а идентификатор проверяется на uuid вместе с остальным телом.
 */
router.post("/import", requireWriteScope, validateBody(ImportRequestSchema), (req, res) =>
  tryCatch(res, async () => {
    const request: ImportRequest = req.body;

    const [designSystem] = await db
      .select()
      .from(designSystems)
      .where(andOptional(eq(designSystems.id, request.designSystemId), designSystemScopeFilter(req)));

    if (!designSystem || !designSystemBelongsToScope(designSystem, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const report = await db.transaction(async (tx) => {
        const result = await importComponents(tx, designSystem.id, request.components);

        await tx.insert(designSystemChanges).values({
          designSystemId: designSystem.id,
          entityType: "components:import",
          entityId: designSystem.id,
          operation: result.created > 0 ? "created" : "updated",
          data: {
            meta: request.meta,
            dryRun: request.dryRun,
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
            rejected: result.rejected,
          },
        });

        if (request.dryRun) {
          throw new DryRunRollback(result);
        }
        return result;
      });

      res.json(report);
    } catch (error) {
      if (error instanceof DryRunRollback) {
        res.json(error.payload);
        return;
      }
      // Импорт пишет тысячи строк в одной транзакции, поэтому причину отказа нужно видеть
      // на сервере: клиент получает только статус и краткое сообщение.
      console.error("[component-config:import] failed", {
        designSystemId: designSystem.id,
        meta: request.meta,
        components: request.components.length,
        error,
      });
      res.status(422).json({
        error: "Import failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }),
);

export default router;
