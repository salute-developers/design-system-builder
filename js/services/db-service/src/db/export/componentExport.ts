import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../schema";
import { PAINT_TYPES, deriveValueType, isUnderivedPaint, placeValue, restoreJsonType } from "./valueType";

/**
 * Сборка пакета конфигураций компонентов для выгрузки.
 *
 * Формат — тот же common, что принимает `/import`, поэтому круг `push -> fetch` замкнут:
 * CLI преобразует его в native-конфигурацию тем же кодеком, что и в обратную сторону.
 */

export interface ExportedComponent {
  componentName: string;
  styleName: string;
  config: unknown;
}

export interface ComponentPackage {
  meta: { name: string; version: string };
  components: ExportedComponent[];
  /**
   * Значения, вид заливки которых не выведен: ссылка на токен не разрешилась, и отдан
   * фолбэк на тип свойства. Для градиента с битой ссылкой это значит, что в ответ ушёл
   * `color`, и умалчивать об этом нельзя — тема соберётся другой.
   */
  underivedTypes: string[];
}

export type ExportResult =
  | { ok: true; package: ComponentPackage }
  | { ok: false; reason: string };

/**
 * Переводит имя компонента из формы кода в форму `meta.json`.
 *
 * `components.name` хранит имя со стороны кода (`CheckBox`), а пакет `theme-converter`
 * адресует конфигурации кебабом (`check-box`).
 */
export const camelToKebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

/** Обратное преобразование, которым имя восстанавливает плагин. */
export const techToCamelCase = (name: string): string =>
  name
    .split(/[.-]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

type Database = {
  select: (...args: never[]) => unknown;
} & Record<string, unknown>;

/**
 * Собирает пакет дизайн-системы целиком.
 *
 * Отказ возвращается значением, а не исключением: у ручки один способ ответить на любую
 * неполноту модели, и различать её виды по типу ошибки незачем.
 */
export const buildComponentPackage = async (
  db: any,
  designSystem: { id: string; name: string },
): Promise<ExportResult> => {
  const [version] = await db
    .select({ version: schema.designSystemVersions.version })
    .from(schema.designSystemVersions)
    .where(
      and(
        eq(schema.designSystemVersions.designSystemId, designSystem.id),
        eq(schema.designSystemVersions.publicationStatus, "published"),
      ),
    )
    // Второй ключ разбивает точное совпадение времени: две версии, опубликованные в одной
    // транзакции, получают одинаковый `now()`, и без него выбор зависел бы от порядка чтения.
    .orderBy(desc(schema.designSystemVersions.publishedAt), desc(schema.designSystemVersions.version))
    .limit(1);

  // Поле `version` обязательно в модели плагина, и подставлять заглушку нельзя:
  // `0.0.0` уехал бы в собранную тему.
  if (!version) {
    return { ok: false, reason: `Design system '${designSystem.name}' has no published version` };
  }

  const appearances = await db
    .select({
      appearanceId: schema.appearances.id,
      appearanceName: schema.appearances.name,
      componentId: schema.components.id,
      componentName: schema.components.name,
    })
    .from(schema.appearances)
    .innerJoin(schema.components, eq(schema.appearances.componentId, schema.components.id))
    .where(eq(schema.appearances.designSystemId, designSystem.id));

  if (appearances.length === 0) {
    return {
      ok: true,
      package: {
        meta: { name: designSystem.name, version: version.version },
        components: [],
        underivedTypes: [],
      },
    };
  }

  // Имя компонента выводится правилом и проверяется на обратимость на границе: неверное
  // имя в `meta.json` плагин не найдёт, и отказ здесь честнее молчаливой подмены.
  for (const row of appearances) {
    const kebab = camelToKebab(row.componentName);
    if (techToCamelCase(kebab) !== row.componentName) {
      return {
        ok: false,
        reason: `Component name '${row.componentName}' is not reversible: '${kebab}' converts back to '${techToCamelCase(kebab)}'`,
      };
    }
  }

  const context = await loadContext(db, designSystem.id, appearances);

  const components = appearances
    .map((appearance: any) => ({
      componentName: camelToKebab(appearance.componentName),
      styleName: appearance.appearanceName ?? "default",
      config: buildConfig(appearance, context),
    }))
    // Порядок ответа детерминирован: иначе повторная выгрузка давала бы дифф на пустом месте.
    .sort(
      (left: ExportedComponent, right: ExportedComponent) =>
        left.componentName.localeCompare(right.componentName) ||
        left.styleName.localeCompare(right.styleName),
    );

  return {
    ok: true,
    package: {
      meta: { name: designSystem.name, version: version.version },
      components,
      underivedTypes: [...context.underivedTypes].sort(),
    },
  };
};

interface StateNamed {
  states: string[];
}

interface ValueRow extends StateNamed {
  /** Порядок переопределения в массиве `states` конфигурации. */
  position: number;
  propertyName: string;
  propertyType: string;
  value: string | null;
  alpha: string | null;
  adjustment: string | null;
  tokenType: string | null;
  tokenName: string | null;
}

interface AxisValue {
  styleId: string;
  name: string;
  authoredId: string | null;
}

interface Axis {
  variationId: string;
  name: string;
  defaultStyleId: string | null;
  isColorScheme: boolean;
  declaredType: string | null;
  values: AxisValue[];
}

interface Context {
  axesByAppearance: Map<string, Axis[]>;
  invariantsByAppearance: Map<string, ValueRow[]>;
  variationValuesByStyle: Map<string, ValueRow[]>;
  /**
   * Кросс-осевые значения по ключу `appearanceId:styleId`.
   *
   * Одним `styleId` индексировать нельзя: стиль принадлежит паре (ДС, ось) и потому общий
   * для всех appearance дизайн-системы. Сочетание же принадлежит appearance, и индекс
   * по стилю раздавал бы его соседям — конфигурация с одной осью и без переопределений
   * получала бы чужое пересечение.
   */
  combinationsByOwner: Map<
    string,
    Array<{
      targets: Array<{ id: string; value: string }>;
      rows: ValueRow[];
      authoredId: string | null;
    }>
  >;
  underivedTypes: Set<string>;
}

/**
 * Значение оси в общем формате.
 *
 * `styles.name` — text, поэтому значение boolean-оси лежит строкой. Тип оси выводится
 * из набора её объявленных значений: ось, значения которой суть `true` и `false`,
 * отдаётся с JSON-булями, иначе строкой.
 */
const axisValue = (axis: Axis, name: string): string | boolean => {
  const declared = new Set(axis.values.map((value) => value.name));
  const isBoolean = declared.size === 2 && declared.has("true") && declared.has("false");
  return isBoolean ? name === "true" : name;
};

/**
 * Выводит вид заливки значения.
 *
 * Тип слота приходит из кода компонента и покрывает семейство целиком; какой заливкой
 * оказалось конкретное значение, знает токен, на который оно ссылается.
 */
const deriveType = (row: ValueRow, context: Context, where: string): string => {
  // Ссылка не разрешилась — вид заливки восстановить нечем. Отдаём тип слота и говорим
  // об этом вслух: молчаливая подмена градиента цветом соберётся в другую тему.
  if (isUnderivedPaint(row.propertyType, row.tokenType)) {
    context.underivedTypes.add(`${where}.${row.propertyName}`);
  }
  return deriveValueType(row.propertyType, row.tokenType);
};

/** Собирает значение свойства вместе с переопределениями состояний. */
const buildProperty = (rows: ValueRow[], context: Context, where: string): Record<string, unknown> | null => {
  const base = rows.find((row) => row.states.length === 0);
  if (!base) return null;

  const type = deriveType(base, context, where);
  const property: Record<string, unknown> = { type };

  // Цвет и градиент лежат в `default`, остальные типы — в `value`.
  Object.assign(property, placeValue(type, restoreJsonType(base.value ?? base.tokenName, type)));

  if (base.alpha !== null) property.alpha = Number(base.alpha);
  if (base.adjustment !== null) property.adjustment = Number(base.adjustment);

  const states = rows
    .filter((row) => row.states.length > 0)
    // Порядок берётся из хранимой позиции, а не из имён состояний: в ColorStateList
    // Android выигрывает первое совпадение, и алфавит дал бы другую тему.
    .sort((left, right) => left.position - right.position)
    .map((row) => {
      const stateType = deriveType(row, context, where);
      const entry: Record<string, unknown> = {
        state: row.states,
        value: restoreJsonType(row.value ?? row.tokenName, stateType),
      };
      if (row.alpha !== null) entry.alpha = Number(row.alpha);
      // Тип переопределения пишется только при расхождении с базой: при его отсутствии
      // плагин берёт тип базового значения, а корпус пишет `type` только у расходящихся.
      if (stateType !== type) entry.type = stateType;
      return entry;
    });

  if (states.length > 0) property.states = states;
  return property;
};

/** Свойства одной координаты: имя свойства -> значение. */
const buildProperties = (
  rows: ValueRow[],
  context: Context,
  where: string,
): Record<string, unknown> => {
  const byProperty = new Map<string, ValueRow[]>();
  for (const row of rows) {
    byProperty.set(row.propertyName, [...(byProperty.get(row.propertyName) ?? []), row]);
  }

  const result: Record<string, unknown> = {};
  // Порядок ключей детерминирован: по имени свойства.
  for (const name of [...byProperty.keys()].sort()) {
    const property = buildProperty(byProperty.get(name)!, context, where);
    if (property) result[name] = property;
  }
  return result;
};

/** Собирает конфигурацию одного appearance. */
const buildConfig = (
  appearance: { appearanceId: string; componentName: string; appearanceName: string | null },
  context: Context,
): Record<string, unknown> => {
  const where = `${camelToKebab(appearance.componentName)}.${appearance.appearanceName ?? "default"}`;
  const axes = context.axesByAppearance.get(appearance.appearanceId) ?? [];
  const axisByVariationId = new Map(axes.map((axis) => [axis.variationId, axis]));

  const defaults = axes
    .filter((axis) => axis.defaultStyleId)
    .map((axis) => {
      const value = axis.values.find((entry) => entry.styleId === axis.defaultStyleId);
      return value ? { id: axis.name, value: axisValue(axis, value.name) } : null;
    })
    .filter((entry): entry is { id: string; value: string | boolean } => entry !== null);

  const variations = axes.map((axis) => ({
    // Общий формат адресует оси именами, а не идентификаторами строк: uuid уехал бы
    // в native-конфигурацию именем оси.
    id: axis.name,
    name: axis.name,
    // Тип объявления отдаётся отдельно от роли: кодек обязан воспроизвести его как есть,
    // а не вывести из того, что ось оказалась осью схемы.
    ...(axis.declaredType ? { declaredType: axis.declaredType } : {}),
    values: axis.values.flatMap((value) => {
      const entries: Array<Record<string, unknown>> = [];

      const own = context.variationValuesByStyle.get(`${appearance.appearanceId}:${value.styleId}`) ?? [];
      // Имя значения оси — строка, а не примитив: в общем формате примитив несут только
      // `defaults[].value` и `targets[].properties[].value`, а `values[].name` именует
      // значение. Кодек восстанавливает примитив по этим двум местам именно потому,
      // что имя строкой.
      entries.push({
        name: value.name,
        properties: buildProperties(own, context, where),
        // Идентификатор отдаётся, если сохранён: плагин строит из него имя стиля.
        // Родитель не отдаётся — кодек выводит его из идентификаторов.
        ...(value.authoredId ? { authoredId: value.authoredId } : {}),
      });

      const combinationKey = `${appearance.appearanceId}:${value.styleId}`;
      for (const combination of context.combinationsByOwner.get(combinationKey) ?? []) {
        entries.push({
          name: value.name,
          targets: [
            {
              properties: combination.targets.map((target) => {
                const targetAxis = axisByVariationId.get(target.id);
                return {
                  id: targetAxis?.name ?? target.id,
                  value: targetAxis ? axisValue(targetAxis, target.value) : target.value,
                };
              }),
            },
          ],
          properties: buildProperties(combination.rows, context, where),
          ...(combination.authoredId ? { authoredId: combination.authoredId } : {}),
        });
      }
      return entries;
    }),
  }));

  const invariants = buildProperties(
    context.invariantsByAppearance.get(appearance.appearanceId) ?? [],
    context,
    where,
  );

  // Корневая ось определяется по имени: явного признака в схеме для неё нет.
  const rootVariationId = axes.find((axis) => axis.name === "size")?.name ?? null;
  // Ось цветовой схемы берётся из объявления. Прежде она искалась по имени `view`, и на
  // корпусе, где ось называется иначе, выгрузка теряла её роль: значения уходили обычными
  // вариациями вместо блока `view`. Имён у неё шесть только в `sdds_sbcom`.
  const colorSchemeVariationId = axes.find((axis) => axis.isColorScheme)?.name ?? null;

  return { rootVariationId, colorSchemeVariationId, invariants, defaults, variations };
};

/**
 * Читает всё, что нужно для сборки пакета, пакетными запросами.
 *
 * Запрос на конфигурацию был бы прост, но для полутора сотен конфигураций дал бы полторы
 * тысячи обращений в базу; здесь их постоянное число.
 */
interface Member {
  combinationId: string;
  styleId: string;
  variationId: string;
  styleName: string;
}

const loadContext = async (
  db: any,
  designSystemId: string,
  appearances: Array<{ appearanceId: string }>,
): Promise<Context> => {
  const appearanceIds = appearances.map((row) => row.appearanceId);

  const context: Context = {
    axesByAppearance: new Map(),
    invariantsByAppearance: new Map(),
    variationValuesByStyle: new Map(),
    combinationsByOwner: new Map(),
    underivedTypes: new Set(),
  };

  // ── Объявления осей: состав, порядок, дефолт и объявленные значения ────────────
  const axisRows = await db
    .select({
      appearanceId: schema.appearanceVariations.appearanceId,
      variationId: schema.appearanceVariations.variationId,
      name: schema.variations.name,
      position: schema.appearanceVariations.position,
      defaultStyleId: schema.appearanceVariations.defaultStyleId,
      isColorScheme: schema.appearanceVariations.isColorScheme,
      declaredType: schema.appearanceVariations.declaredType,
      axisId: schema.appearanceVariations.id,
    })
    .from(schema.appearanceVariations)
    .innerJoin(schema.variations, eq(schema.appearanceVariations.variationId, schema.variations.id))
    .where(inArray(schema.appearanceVariations.appearanceId, appearanceIds))
    .orderBy(schema.appearanceVariations.position);

  const valueRows = axisRows.length
    ? await db
        .select({
          axisId: schema.appearanceVariationValues.appearanceVariationId,
          styleId: schema.appearanceVariationValues.styleId,
          name: schema.styles.name,
          position: schema.appearanceVariationValues.position,
          authoredId: schema.appearanceVariationValues.authoredId,
        })
        .from(schema.appearanceVariationValues)
        .innerJoin(schema.styles, eq(schema.appearanceVariationValues.styleId, schema.styles.id))
        .where(
          inArray(
            schema.appearanceVariationValues.appearanceVariationId,
            axisRows.map((row: any) => row.axisId),
          ),
        )
        .orderBy(schema.appearanceVariationValues.position)
    : [];

  const valuesByAxis = new Map<string, AxisValue[]>();
  for (const row of valueRows) {
    valuesByAxis.set(row.axisId, [
      ...(valuesByAxis.get(row.axisId) ?? []),
      { styleId: row.styleId, name: row.name, authoredId: row.authoredId },
    ]);
  }
  for (const row of axisRows) {
    const axis: Axis = {
      variationId: row.variationId,
      name: row.name,
      defaultStyleId: row.defaultStyleId,
      isColorScheme: row.isColorScheme,
      declaredType: row.declaredType,
      values: valuesByAxis.get(row.axisId) ?? [],
    };
    context.axesByAppearance.set(row.appearanceId, [
      ...(context.axesByAppearance.get(row.appearanceId) ?? []),
      axis,
    ]);
  }

  // ── Имена состояний по набору ────────────────────────────────────────────────
  const stateRows = await db
    .select({ setId: schema.stateSets.id, name: schema.states.name })
    .from(schema.stateSets)
    // Набор состояний — массив uuid, поэтому соединение идёт через ANY: внешних ключей
    // внутрь массива в PostgreSQL нет, целостность держат триггеры миграции 0004.
    .innerJoin(schema.states, sql`${schema.states.id} = ANY(${schema.stateSets.stateIds})`);
  const statesBySet = new Map<string, string[]>();
  for (const row of stateRows) {
    statesBySet.set(row.setId, [...(statesBySet.get(row.setId) ?? []), row.name].sort());
  }
  const statesOf = (setId: string): string[] => statesBySet.get(setId) ?? [];

  // ── Инварианты ───────────────────────────────────────────────────────────────
  const invariantRows = await db
    .select({
      appearanceId: schema.invariantPropertyValues.appearanceId,
      propertyName: schema.properties.name,
      propertyType: schema.properties.type,
      value: schema.invariantPropertyValues.value,
      alpha: schema.invariantPropertyValues.alpha,
      adjustment: schema.invariantPropertyValues.adjustment,
      position: schema.invariantPropertyValues.position,
      tokenType: schema.tokens.type,
      tokenName: schema.tokens.name,
      stateSetId: schema.invariantPropertyValues.stateSetId,
    })
    .from(schema.invariantPropertyValues)
    .innerJoin(schema.properties, eq(schema.invariantPropertyValues.propertyId, schema.properties.id))
    .leftJoin(schema.tokens, eq(schema.invariantPropertyValues.tokenId, schema.tokens.id))
    .where(eq(schema.invariantPropertyValues.designSystemId, designSystemId));

  for (const row of invariantRows) {
    const entry: ValueRow = { ...row, states: statesOf(row.stateSetId) };
    context.invariantsByAppearance.set(row.appearanceId, [
      ...(context.invariantsByAppearance.get(row.appearanceId) ?? []),
      entry,
    ]);
  }

  // ── Значения вариаций ────────────────────────────────────────────────────────
  const variationRows = await db
    .select({
      appearanceId: schema.variationPropertyValues.appearanceId,
      styleId: schema.variationPropertyValues.styleId,
      propertyName: schema.properties.name,
      propertyType: schema.properties.type,
      value: schema.variationPropertyValues.value,
      alpha: schema.variationPropertyValues.alpha,
      adjustment: schema.variationPropertyValues.adjustment,
      position: schema.variationPropertyValues.position,
      tokenType: schema.tokens.type,
      tokenName: schema.tokens.name,
      stateSetId: schema.variationPropertyValues.stateSetId,
    })
    .from(schema.variationPropertyValues)
    .innerJoin(schema.properties, eq(schema.variationPropertyValues.propertyId, schema.properties.id))
    .leftJoin(schema.tokens, eq(schema.variationPropertyValues.tokenId, schema.tokens.id))
    .where(inArray(schema.variationPropertyValues.appearanceId, appearanceIds));

  for (const row of variationRows) {
    const key = `${row.appearanceId}:${row.styleId}`;
    context.variationValuesByStyle.set(key, [
      ...(context.variationValuesByStyle.get(key) ?? []),
      { ...row, states: statesOf(row.stateSetId) },
    ]);
  }

  // ── Кросс-осевые сочетания ───────────────────────────────────────────────────
  const combinationRows = await db
    .select({
      combinationId: schema.styleCombinations.id,
      appearanceId: schema.styleCombinations.appearanceId,
      propertyName: schema.properties.name,
      propertyType: schema.properties.type,
      value: schema.styleCombinations.value,
      alpha: schema.styleCombinations.alpha,
      adjustment: schema.styleCombinations.adjustment,
      position: schema.styleCombinations.position,
      tokenType: schema.tokens.type,
      tokenName: schema.tokens.name,
      stateSetId: schema.styleCombinations.stateSetId,
    })
    .from(schema.styleCombinations)
    .innerJoin(schema.properties, eq(schema.styleCombinations.propertyId, schema.properties.id))
    .leftJoin(schema.tokens, eq(schema.styleCombinations.tokenId, schema.tokens.id))
    .where(inArray(schema.styleCombinations.appearanceId, appearanceIds));

  const combinationIds: string[] = [
    ...new Set<string>(combinationRows.map((row: any) => row.combinationId as string)),
  ];

  const memberRows = combinationRows.length
    ? await db
        .select({
          combinationId: schema.styleCombinationMembers.combinationId,
          styleId: schema.styleCombinationMembers.styleId,
          variationId: schema.styles.variationId,
          styleName: schema.styles.name,
        })
        .from(schema.styleCombinationMembers)
        .innerJoin(schema.styles, eq(schema.styleCombinationMembers.styleId, schema.styles.id))
        .where(
          inArray(schema.styleCombinationMembers.combinationId, combinationIds),
        )
    : [];

  const membersByCombination = new Map<string, Member[]>();
  for (const row of memberRows as Member[]) {
    membersByCombination.set(row.combinationId, [...(membersByCombination.get(row.combinationId) ?? []), row]);
  }

  // Сочетание принадлежит одному значению оси, а не всем участникам: иначе одно и то же
  // переопределение попало бы в конфигурацию столько раз, сколько в нём осей. Владельцем
  // выбирается участник с наибольшей позицией оси — то есть самая внутренняя ось.
  const positionByVariation = new Map<string, number>();
  for (const row of axisRows) positionByVariation.set(row.variationId, row.position);
  // Оси цветовой схемы: они владеют сочетанием, в котором участвуют, — см. выбор владельца ниже.
  const colorSchemeVariations = new Set(
    axisRows.filter((row: any) => row.isColorScheme).map((row: any) => row.variationId as string),
  );

  const rowsByCombination = new Map<string, ValueRow[]>();
  for (const row of combinationRows) {
    rowsByCombination.set(row.combinationId, [
      ...(rowsByCombination.get(row.combinationId) ?? []),
      { ...row, states: statesOf(row.stateSetId) },
    ]);
  }

  // ── Объявленные координаты ───────────────────────────────────────────────────
  //
  // Координаты берутся из объявления, а не выводятся из наличия значений: сочетание,
  // которому конфигурация не задала ни одного свойства, всё равно объявлено, и вывод
  // из значений терял бы его.
  const declaredCombinationRows = await db
    .select({
      id: schema.appearanceCombinations.id,
      appearanceId: schema.appearanceCombinations.appearanceId,
      combinationKey: schema.appearanceCombinations.combinationKey,
      position: schema.appearanceCombinations.position,
      authoredId: schema.appearanceCombinations.authoredId,
    })
    .from(schema.appearanceCombinations)
    .where(inArray(schema.appearanceCombinations.appearanceId, appearanceIds))
    .orderBy(schema.appearanceCombinations.position);

  const declaredMemberRows = declaredCombinationRows.length
    ? await db
        .select({
          combinationId: schema.appearanceCombinationMembers.appearanceCombinationId,
          styleId: schema.appearanceCombinationMembers.styleId,
          variationId: schema.styles.variationId,
          styleName: schema.styles.name,
          position: schema.appearanceCombinationMembers.position,
        })
        .from(schema.appearanceCombinationMembers)
        .innerJoin(schema.styles, eq(schema.appearanceCombinationMembers.styleId, schema.styles.id))
        .where(
          inArray(
            schema.appearanceCombinationMembers.appearanceCombinationId,
            declaredCombinationRows.map((row: any) => row.id as string),
          ),
        )
        .orderBy(schema.appearanceCombinationMembers.position)
    : [];

  const declaredMembersByCombination = new Map<string, Member[]>();
  for (const row of declaredMemberRows as Member[]) {
    declaredMembersByCombination.set(row.combinationId, [
      ...(declaredMembersByCombination.get(row.combinationId) ?? []),
      row,
    ]);
  }

  const appearanceByCombination = new Map<string, string>(
    combinationRows.map((row: any) => [row.combinationId as string, row.appearanceId as string]),
  );

  // Значения группируются по канонической координате: она общая у объявления и у строк
  // значений, и по ней они и сопоставляются.
  const rowsByKey = new Map<string, ValueRow[]>();
  for (const [combinationId, rows] of rowsByCombination) {
    const members = membersByCombination.get(combinationId) ?? [];
    const key = `${appearanceByCombination.get(combinationId)}:${members
      .map((member: Member) => member.styleId)
      .sort()
      .join(",")}`;
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), ...rows]);
  }

  // Обход идёт по объявлениям, а не по значениям: координата без единого переопределения
  // тоже принадлежит конфигурации.
  for (const declaration of declaredCombinationRows) {
    const members = declaredMembersByCombination.get(declaration.id) ?? [];
    if (members.length === 0) continue;

    // Владелец сочетания — тот его участник, чьё значение несёт свойства, а остальные ему цели.
    //
    // Ось цветовой схемы владеет всегда, когда участвует: в native-формате её значения лежат
    // записями `view` **внутри** вариации, то есть координата вариации им цель, а не наоборот.
    // Прежнее правило брало ось с наибольшей позицией и на этом ошибалось: у `counter`
    // из `sdds_sbcom` оси `mute`(0) и `type`(1), владеть должна `mute`, а выбиралась `type`.
    //
    // Замер по двум корпусам: правило «схема первее, иначе последняя по позиции» верно
    // на 973 сочетаниях из 973, прежнее ошибалось в 236.
    const byPosition = (left: Member, right: Member) =>
      (positionByVariation.get(right.variationId) ?? -1) - (positionByVariation.get(left.variationId) ?? -1);
    const schemeMember = members.find((member: Member) => colorSchemeVariations.has(member.variationId));
    const owner = schemeMember ?? [...members].sort(byPosition)[0];
    const targets = members
      .filter((member: Member) => member.styleId !== owner.styleId)
      .map((member: Member) => ({ id: member.variationId, value: member.styleName }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const key = `${declaration.appearanceId}:${owner.styleId}`;
    context.combinationsByOwner.set(key, [
      ...(context.combinationsByOwner.get(key) ?? []),
      {
        targets,
        rows: rowsByKey.get(`${declaration.appearanceId}:${declaration.combinationKey}`) ?? [],
        authoredId: declaration.authoredId,
      },
    ]);
  }

  return context;
};
