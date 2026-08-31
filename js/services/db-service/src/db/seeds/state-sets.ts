import { and, eq, isNull, sql } from "drizzle-orm";
import * as schema from "../schema";

/**
 * Строка-сентинел пустого набора. Идентификатор задан миграцией детерминированно — затем,
 * чтобы базовое значение можно было записать, не обращаясь к справочнику.
 */
export const SENTINEL_STATE_SET_ID = "00000000-0000-4000-8000-0000000000ff";

/**
 * Разрешает имя состояния взаимодействия в идентификатор набора из одного элемента.
 *
 * Сиды знают только состояния взаимодействия: состояния компонента объявляет его код и
 * заводит заливка `uikit-api-meta.json`. Пустое имя даёт сентинел, то есть базовое значение.
 *
 * Наборы кэшируются в пределах прогона: сид пишет тысячи значений на полтора десятка
 * различных состояний.
 */
export const makeStateSetResolver = (db: any) => {
  const cache = new Map<string, string>([["", SENTINEL_STATE_SET_ID]]);

  return async (name: string | null | undefined): Promise<string> => {
    const key = name ?? "";
    const cached = cache.get(key);
    if (cached) return cached;

    const [state] = await db
      .select({ id: schema.states.id })
      .from(schema.states)
      .where(and(isNull(schema.states.componentId), eq(schema.states.name, key)));

    if (!state) {
      throw new Error(
        `Seed references an unknown interaction state '${key}'. ` +
          `The dictionary is seeded by the migration; add the state there, not here.`,
      );
    }

    const literal = sql.raw(`'{${state.id}}'::uuid[]`);
    const [existing] = await db
      .select({ id: schema.stateSets.id })
      .from(schema.stateSets)
      .where(sql`${schema.stateSets.stateIds} = ${literal}`);

    const id =
      existing?.id ??
      (
        await db
          .insert(schema.stateSets)
          .values({ stateIds: [state.id] })
          .returning({ id: schema.stateSets.id })
      )[0].id;

    cache.set(key, id);
    return id;
  };
};
