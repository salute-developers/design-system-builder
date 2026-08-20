import { Router } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { states } from "../../db/schema";
import {
  CreateStateSchema,
  UpdateStateSchema,
  UuidParamSchema,
} from "../../validation/schema";
import { validateBody, validateParams } from "../../validation/middleware";
import { assertFound, tryCatch } from "./utils";
import { z } from "zod";

// Словарь состояний: и взаимодействия (`component_id` пуст), и объявленные кодом компонента.
// Заменяет прежний `/ds/component-states`, который знал только вторые.

// `componentId=null` — только состояния взаимодействия; иначе состояния компонента.
const ComponentFilterSchema = z.union([z.string().uuid(), z.literal("null")]).optional();

const router = Router();

router.get("/", (req, res) =>
  tryCatch(res, async () => {
    const parsed = ComponentFilterSchema.safeParse(req.query.componentId);
    if (!parsed.success) {
      res.status(400).json({ error: z.flattenError(parsed.error) });
      return;
    }

    const componentId = parsed.data;
    const filter =
      componentId === undefined
        ? undefined
        : componentId === "null"
          ? isNull(states.componentId)
          : eq(states.componentId, componentId);

    res.json(await db.select().from(states).where(filter));
  }),
);

// Предпросмотр удаления. Наборы разделяются между значениями, поэтому одна кнопка на
// глобальном состоянии стоит сотен значений в десятках компонентов: `{hovered}` — одна
// строка, на которую ссылается всё. Данные ручка не меняет.
//
// Маршрут объявлен до `/:id`, иначе Express отдал бы `impact` параметром идентификатора.
router.get("/:id/impact", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.select().from(states).where(eq(states.id, req.params.id));
    if (!assertFound(row, res)) return;

    const [impact] = await db.execute<{
      state_sets: number;
      values: number;
      components: number;
    }>(sql`
      WITH doomed AS (
        SELECT id FROM state_sets WHERE state_ids @> ARRAY[${req.params.id}::uuid]
      ),
      affected AS (
        SELECT v.state_set_id, vr.component_id
          FROM variation_property_values v
          JOIN doomed d ON d.id = v.state_set_id
          JOIN styles st ON st.id = v.style_id
          JOIN variations vr ON vr.id = st.variation_id
        UNION ALL
        SELECT v.state_set_id, v.component_id
          FROM invariant_property_values v
          JOIN doomed d ON d.id = v.state_set_id
      )
      SELECT
        (SELECT count(*) FROM doomed)::int                              AS state_sets,
        (SELECT count(*) FROM affected)::int                            AS values,
        (SELECT count(DISTINCT component_id) FROM affected)::int        AS components
    `);

    res.json({
      stateSets: Number(impact?.state_sets ?? 0),
      values: Number(impact?.values ?? 0),
      components: Number(impact?.components ?? 0),
    });
  }),
);

router.get("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.select().from(states).where(eq(states.id, req.params.id));
    if (!assertFound(row, res)) return;
    res.json(row);
  }),
);

router.post("/", validateBody(CreateStateSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.insert(states).values(req.body).returning();
    res.status(201).json(row);
  }),
);

router.patch("/:id", validateParams(UuidParamSchema), validateBody(UpdateStateSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db
      .update(states)
      .set(req.body)
      .where(eq(states.id, req.params.id))
      .returning();
    if (!assertFound(row, res)) return;
    res.json(row);
  }),
);

// Удаление применяет политику: триггер сносит наборы, содержащие состояние, а каскад по
// state_set_id — значения, которые на них ссылались. Набор не сжимается.
router.delete("/:id", validateParams(UuidParamSchema), (req, res) =>
  tryCatch(res, async () => {
    const [row] = await db.delete(states).where(eq(states.id, req.params.id)).returning();
    if (!assertFound(row, res)) return;
    res.json({ ok: true });
  }),
);

export default router;
