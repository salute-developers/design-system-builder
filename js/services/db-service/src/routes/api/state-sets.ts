import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { stateSets } from "../../db/schema";
import { ResolveStateSetSchema, UuidParamSchema } from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";
import { z } from "zod";

const router = Router();

router.get("/", (_req, res) =>
  tryCatch(res, async () => {
    res.json(await db.select().from(stateSets));
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.select().from(stateSets).where(eq(stateSets.id, req.params.id));
    if (!assertFound(row, res)) return;
    res.json(row);
  }),
);

// Единственная точка конструирования набора.
//
// Импорт и админка обязаны ходить сюда; прямая запись в `state_sets` из клиентского кода
// запрещена. Операция не CRUD над ресурсом: она возвращает идентификатор существующего
// набора либо заводит недостающий, поэтому действие вынесено отдельным сегментом и не
// занимает слот идентификатора в коллекции — как `/ds/component-config/import`.
//
// Канонизацию, проверку элементов и вычисление владельца делает триггер на таблице: здесь
// они не дублируются, чтобы не появилось второе место, где набор считается своим способом.
router.post("/resolve", validateBody(ResolveStateSetSchema), (req, res) =>
  tryCatch(res, async () => {
    const { stateIds } = req.body as z.infer<typeof ResolveStateSetSchema>;

    const canonical = [...new Set(stateIds)].sort();

    const [existing] = await db
      .select()
      .from(stateSets)
      .where(sql`${stateSets.stateIds} = ${sql.raw(`'{${canonical.join(",")}}'::uuid[]`)}`);

    if (existing) {
      res.json({ id: existing.id, ownerComponentId: existing.ownerComponentId });
      return;
    }

    try {
      const [created] = await db.insert(stateSets).values({ stateIds: canonical }).returning();
      res.status(201).json({ id: created.id, ownerComponentId: created.ownerComponentId });
    } catch (error) {
      // Неизвестное состояние и смешивание компонентов отвергает триггер. Это ошибка
      // запроса, а не сбой сервера, поэтому переводится в 400 с текстом из БД.
      //
      // Сообщение ищется и в причине: drizzle заворачивает ошибку драйвера, и в `message`
      // верхнего уровня лежит текст запроса, а не то, что сказал триггер.
      const messages: string[] = [];
      for (let e: unknown = error; e instanceof Error; e = (e as { cause?: unknown }).cause) {
        messages.push(e.message);
      }
      const trigger = messages.find((m) =>
        /state that does not exist|mixes component states/.test(m),
      );
      if (trigger) {
        res.status(400).json({ error: trigger });
        return;
      }
      throw error;
    }
  }),
);

export default router;
