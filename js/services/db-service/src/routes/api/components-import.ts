import { Request, Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index";
import { designSystems, designSystemChanges } from "../../db/schema";
import { ImportRequestSchema } from "../../db/import/commonConfig";
import { importComponents } from "../../db/import/componentImport";
import { andOptional, designSystemScopeFilter, designSystemBelongsToScope, isSystemAdmin, tryCatch } from "./utils";

const WRITE_SCOPE = "components:write";
const IMPORT_ACTION = "components:import";

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

const router = Router({ mergeParams: true });

/**
 * Загружает пакет конфигураций компонентов в дизайн-систему одним запросом.
 *
 * Путь содержит двоеточие (`components:import`), поэтому действие читается параметром:
 * в шаблоне Express двоеточие начинает имя параметра.
 */
router.post("/:id/:action", (req, res) =>
  tryCatch(res, async () => {
    if (req.params.action !== IMPORT_ACTION) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!hasWriteScope(req)) {
      res.status(403).json({ error: `Scope '${WRITE_SCOPE}' is required` });
      return;
    }

    const parsed = ImportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid import request", details: parsed.error.issues });
      return;
    }

    const [designSystem] = await db
      .select()
      .from(designSystems)
      .where(andOptional(eq(designSystems.id, req.params.id), designSystemScopeFilter(req)));

    if (!designSystem || !designSystemBelongsToScope(designSystem, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const request = parsed.data;

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
      console.error("[components:import] failed", {
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
