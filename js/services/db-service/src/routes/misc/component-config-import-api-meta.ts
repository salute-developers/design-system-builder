import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../../db/index";
import { designSystemChanges } from "../../db/schema";
import { ApiMetaImportRequest, ApiMetaImportRequestSchema } from "../../db/import/apiMetaManifest";
import { importApiMeta } from "../../db/import/apiMetaImport";
import { validateBody } from "../../validation/middleware";
import { getUserId, requireSystemAdmin, tryCatch } from "../api/utils";

/**
 * Признак отката транзакции для режима dry run: работа выполняется целиком, затем
 * откатывается, поэтому отчёт совпадает с тем, что произойдёт при применении.
 */
class DryRunRollback extends Error {
  constructor(public readonly payload: unknown) {
    super("dry run");
  }
}

const router = Router();

/** Имя файла без директорий: локальный путь администратора в журнал попадать не должен. */
const baseName = (source: string): string => source.split(/[\\/]/).pop() ?? "";

/**
 * Заводит в глобальном слое компоненты, свойства, состояния и платформенные имена из
 * манифеста API-меты одним запросом.
 *
 * Операция административная: слой общий для всех дизайн-систем всех проектов. Роль проверяется
 * до разбора тела (`requireSystemAdmin`), а на gateway маршрут `/api/admin` принимает только
 * токен пользователя, поэтому ключ проекта отсекается ещё на входе.
 *
 * Запись аддитивная: существующие строки не меняются. Дизайн-система не участвует: привязок
 * компонентов не создаётся, а журнал `design_system_changes` получает запись без дизайн-системы.
 */
router.post("/import-api-meta", requireSystemAdmin, validateBody(ApiMetaImportRequestSchema), (req, res) =>
  tryCatch(res, async () => {
    const request: ApiMetaImportRequest = req.body;

    try {
      const report = await db.transaction(async (tx) => {
        const result = await importApiMeta(tx, request);
        // Список `absent` может быть длинным и нужен только в ответе: в журнале хранится его размер.
        const { absent, ...counters } = result;

        await tx.insert(designSystemChanges).values({
          designSystemId: null,
          entityType: "components:import-api-meta",
          // У глобальной операции своего идентификатора нет, а колонка обязательна: идентификатор запуска.
          entityId: randomUUID(),
          operation: result.createdComponents + result.createdProperties > 0 ? "created" : "updated",
          data: {
            userId: getUserId(req) ?? null,
            platform: request.platform,
            source: baseName(request.meta.source),
            dryRun: request.dryRun,
            ...counters,
            absentCount: absent.length,
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
      console.error("[admin:import-api-meta] failed", {
        platform: request.platform,
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
