import { and, eq, isNull, sql } from "drizzle-orm";
import * as schema from "../schema";
import {
  CommonConfig,
  ImportComponent,
  PropertyValue,
  axisValueToString,
  propertyValueToText,
  rawToText,
  tokenNameOf,
} from "./commonConfig";

type Tx = Parameters<Parameters<typeof import("../index").db.transaction>[0]>[0];

const COMPONENT_STYLE = "component_style";

/**
 * Словарь типов **значения** конфигурации.
 *
 * Он не выводится из `propertyTypeEnum`, потому что это другой словарь. Перечисление
 * описывает тип слота API компонента и приходит из кода; здесь перечислено то, чем может
 * оказаться конкретное значение. Пересечение большое, но расхождения принципиальны:
 *
 *   * `gradient` есть здесь и отсутствует там. В `plasma-android` тип `color` означает
 *     семейство paint — KSP относит к нему `Color`, `Brush` и `InteractiveColor`, — а
 *     `gradient` различает конкретное значение внутри семейства, а не слот. Замер по
 *     40 файлам api-meta (~52 тыс. параметров) не даёт ни одного `gradient`, замер по
 *     670 конфигурациям даёт 54 значения.
 *   * `integer` есть там и не встречается здесь ни разу: код объявляет счётчики как
 *     `integer`, конфигурации пишут их как `float` или `value`. Оставлен, потому что
 *     отклонять конфигурацию за тип, который слот законно носит, незачем.
 *   * `blur` не входит ни в один из словарей. В перечисление он попал из иллюстративного
 *     enum `common_config_scheme.json`, который сам неполон — в нём нет `icon`, `float`,
 *     `shadow` и `boolean`, которыми корпус пользуется. Значению такого типа некуда лечь:
 *     слота с типом `blur` не бывает, поэтому отказ честнее записи.
 *
 * Связывать их обратно нельзя: сужение или расширение словаря слотов не должно молча
 * менять то, какие конфигурации принимаются.
 */
const VALUE_TYPES = new Set([
  "color",
  "gradient",
  "typography",
  "shape",
  "shadow",
  "dimension",
  "float",
  "integer",
  "boolean",
  "icon",
  "component_style",
  "value",
]);

export interface ImportRejection {
  componentName: string;
  styleName: string;
  reason: string;
}

export interface ImportReport {
  created: number;
  updated: number;
  unchanged: number;
  rejected: ImportRejection[];
  /** Имена токенов, не найденные в дизайн-системе: значение сохранено текстом, ссылка пуста. */
  unresolvedTokens: string[];
  /** Ссылки типа `component_style`, чей стиль не удалось сопоставить компоненту. */
  unresolvedComponentStyles: string[];
  /**
   * Свойства, встречающиеся в конфигурациях, но отсутствующие в глобальном слое.
   *
   * Глобальный слой наполняется из `uikit-api-meta.json` скриптом
   * `scripts/import-uikit-api-meta.sh`, то есть из кода компонентов. Свойство в этом списке
   * означает расхождение дизайна и кода: значения для него не записаны.
   */
  unknownProperties: string[];
  /**
   * Состояния из конфигураций, которых нет ни среди состояний взаимодействия, ни среди
   * объявленных компонентом в `uikit-api-meta.json`. Значения для них не записаны.
   */
  unknownStates: string[];
  /**
   * Свойства, у которых тип глобального слоя не встречается в конфигурациях ни разу.
   *
   * Тип глобального слоя приходит из кода компонента, тип значения — из конфигурации
   * оформления, и расходиться они не должны. Различия в записи одного и того же числа
   * (`integer` против `float` или `value`) сюда не попадают.
   */
  typeMismatches: string[];
  /**
   * Свойства с paint-слотом, которым весь загружаемый пакет не дал ни одного значения
   * типа `color` — только градиенты.
   *
   * Это расхождение оформления и кода: API компонента объявляет слот, принимающий и
   * сплошную заливку, а дизайн пользуется лишь частью. Для сборки темы оно безвредно,
   * поэтому в `typeMismatches` не попадает — семейство paint признано совместимым, — но
   * и молчать о нём незачем.
   *
   * Считается по пакету, а не по конфигурации, и это не деталь: по отдельным
   * конфигурациям корпус даёт 25 срабатываний на четырёх парах, но три из четырёх
   * получают сплошной цвет в других стилях того же компонента. Отчёт по конфигурациям
   * был бы рассказом о том, что этот стиль градиентный, а соседний нет.
   */
  gradientOnlyProperties: string[];
  /**
   * Конфигурации, чьи идентификаторы вариаций не выводятся из значений осей.
   *
   * Идентификатор пишет автор, и правила сборки у него нет: где-то сегменты разделены точкой,
   * где-то слиты дефисом, где-то ось опущена, где-то порядок обратный порядку объявления.
   * Поэтому он хранится — иначе плагин переименовал бы публичные стили темы.
   *
   * Список информационный и ничего не отклоняет. Он нужен, чтобы дрейф был виден: сегодня
   * выводимы 753 вариации из 1219 по двум корпусам, и если доля когда-нибудь дойдёт до полной,
   * хранение можно будет снять, не ломая ничего задним числом.
   */
  underivableVariationIds: string[];
}

/** Строка значения в форме, пригодной для сравнения «до» и «после». */
type ValueSignature = string;

/**
 * Загружает пакет конфигураций компонентов в дизайн-систему.
 *
 * Вся работа выполняется в одной транзакции: частично применённый импорт компонентной
 * модели хуже отказа. Режим `dryRun` выполняет ту же работу и откатывает транзакцию,
 * поэтому отчёт плана совпадает с отчётом применения.
 */
export const importComponents = async (
  tx: Tx,
  designSystemId: string,
  components: ImportComponent[],
): Promise<ImportReport> => {
  const report: ImportReport = {
    created: 0,
    updated: 0,
    unchanged: 0,
    rejected: [],
    unresolvedTokens: [],
    unresolvedComponentStyles: [],
    unknownProperties: [],
    unknownStates: [],
    typeMismatches: [],
    gradientOnlyProperties: [],
    underivableVariationIds: [],
  };

  const tokens = await tx
    .select({ id: schema.tokens.id, name: schema.tokens.name })
    .from(schema.tokens)
    .where(eq(schema.tokens.designSystemId, designSystemId));
  const tokenByName = new Map(tokens.map((token) => [token.name, token.id]));

  const styleNameToComponentName = new Map(
    components.map((entry) => [entry.styleName, entry.componentName]),
  );
  const unresolvedTokens = new Set<string>();
  const unresolvedComponentStyles = new Set<string>();
  const unknownProperties = new Set<string>();
  const unknownStates = new Set<string>();
  const typeMismatches = new Set<string>();
  const paintTypesByProperty = new Map<string, Set<string>>();
  const componentStateIds = new Map<string, string>();
  const interactionStateIds = await loadInteractionStates(tx);
  const stateSetIds = new Map<string, string>();
  const pendingReferences: PendingReference[] = [];

  for (const entry of components) {
    const rejection = validate(entry);
    if (rejection) {
      report.rejected.push(rejection);
      continue;
    }

    const outcome = await importOne(tx, designSystemId, entry, {
      tokenByName,
      styleNameToComponentName,
      unresolvedTokens,
      unresolvedComponentStyles,
      unknownProperties,
      unknownStates,
      typeMismatches,
      paintTypesByProperty,
      componentStateIds,
      interactionStateIds,
      stateSetIds,
      pendingReferences,
    });
    if (outcome === "rejected") {
      report.rejected.push({
        componentName: entry.componentName,
        styleName: entry.styleName,
        reason: `Component '${entry.componentName}' is not present in the global layer`,
      });
    } else {
      report[outcome] += 1;
      if (hasUnderivableVariationIds(entry.config)) {
        report.underivableVariationIds.push(`${entry.componentName}.${entry.styleName}`);
      }
    }
  }

  await resolveReferences(tx, designSystemId, {
    tokenByName,
    styleNameToComponentName,
    unresolvedTokens,
    unresolvedComponentStyles,
    unknownProperties,
    unknownStates,
    typeMismatches,
    paintTypesByProperty,
    componentStateIds,
    interactionStateIds,
    stateSetIds,
    pendingReferences,
  });

  report.unresolvedTokens = [...unresolvedTokens].sort();
  report.unresolvedComponentStyles = [...unresolvedComponentStyles].sort();
  report.unknownProperties = [...unknownProperties].sort();
  report.unknownStates = [...unknownStates].sort();
  report.typeMismatches = [...typeMismatches].sort();
  report.underivableVariationIds.sort();
  report.gradientOnlyProperties = [...paintTypesByProperty]
    .filter(([, types]) => types.size === 1 && types.has("gradient"))
    .map(([key]) => key)
    .sort();
  return report;
};

/**
 * Признак того, что идентификаторы вариаций конфигурации не выводятся из значений осей.
 *
 * Правило вывода — склейка значений координаты точкой, то есть та конвенция, к которой стоило бы
 * прийти. Всё, что от неё отклоняется, приходится хранить: `gap=none` даёт сегмент `no-gap`,
 * булева `has-shadow=true` — сегмент с именем оси, а иногда две оси слиты в один сегмент.
 *
 * Значение без сохранённого идентификатора не считается расхождением: его в native-формате
 * и не было, выводить нечего.
 */
const hasUnderivableVariationIds = (config: CommonConfig): boolean =>
  config.variations.some((variation) =>
    // Ось цветовой схемы пропускается: её значения несут не идентификатор вариации, а ключ
    // записи `view`, и со склейкой значений координаты он не совпадает по построению.
    // Считать его расхождением значило бы записать в отчёт всякую конфигурацию с `view`.
    variation.id !== config.colorSchemeVariationId &&
    variation.values.some((value) => {
      if (!value.authoredId) return false;

      const coordinate = [
        ...(value.targets ?? []).flatMap((target) => target.properties).map((target) => axisValueToString(target.value)),
        axisValueToString(value.name),
      ];
      return value.authoredId !== coordinate.join(".");
    }),
  );

/**
 * Отклоняет конфигурацию, если она использует типы или состояния, которых нет в схеме.
 */
const validate = (entry: ImportComponent): ImportRejection | null => {
  for (const property of allProperties(entry.config)) {
    // Переопределение состояния — такое же значение и может объявить свой тип, поэтому
    // проверяется тем же словарём, а не пропускается.
    const types = [property.type, ...(property.states ?? []).map((state) => state.type)];
    for (const type of types) {
      if (type !== undefined && !VALUE_TYPES.has(type)) {
        return {
          componentName: entry.componentName,
          styleName: entry.styleName,
          reason: `Unsupported property type '${type}'`,
        };
      }
    }
    // Состояния, не входящие в общий enum, считаются специфичными для компонента:
    // они проверяются позже, при разрешении в component_states.
  }
  return null;
};

const allProperties = (config: CommonConfig): PropertyValue[] => [
  ...Object.values(config.invariants),
  ...config.variations.flatMap((variation) =>
    variation.values.flatMap((value) => Object.values(value.properties)),
  ),
];

interface ImportContext {
  tokenByName: Map<string, string>;
  styleNameToComponentName: Map<string, string>;
  unresolvedTokens: Set<string>;
  unresolvedComponentStyles: Set<string>;
  unknownProperties: Set<string>;
  /** Семантические состояния компонента: имя → id. Заполняется при импорте компонента. */
  componentStateIds: Map<string, string>;
  /** Состояния взаимодействия: имя → id. Общие для всех компонентов, читаются один раз. */
  interactionStateIds: Map<string, string>;
  /**
   * Кэш наборов в пределах импорта: канонический ключ из идентификаторов → id набора.
   *
   * Ключ строится из идентификаторов, а не из имён: одно и то же имя на разных компонентах
   * означает разные состояния, и кэш по именам подменял бы их друг другом.
   */
  stateSetIds: Map<string, string>;
  /** Состояния, которых нет ни в enum, ни среди объявленных компонентом. */
  unknownStates: Set<string>;
  /** Свойства, чей тип в глобальном слое не встречается в конфигурациях. */
  typeMismatches: Set<string>;
  /**
   * Виды заливки, встреченные у paint-свойства за весь пакет: `компонент.свойство` -> типы.
   *
   * Копится по всем конфигурациям пакета и подводится в конце: свойство, у которого один
   * стиль градиентный, а другой цветной, расхождением не является.
   */
  paintTypesByProperty: Map<string, Set<string>>;
  /**
   * Ссылки `component_style`, ожидающие разрешения вторым проходом.
   *
   * Разрешить их сразу нельзя: 691 ссылка из 2210 указывает на компонент, который в том же
   * пакете обрабатывается позже родителя, и его стилей на момент записи ещё не существует.
   */
  pendingReferences: PendingReference[];
}

/**
 * Ссылка `component_style`, привязанная к строке значения, из которой она пришла.
 */
interface PendingReference {
  reference: string;
  source:
    | { kind: "invariant"; id: string }
    | { kind: "variation"; id: string }
    | { kind: "combination"; id: string };
}

const importOne = async (
  tx: Tx,
  designSystemId: string,
  entry: ImportComponent,
  context: ImportContext,
): Promise<"created" | "updated" | "unchanged" | "rejected"> => {
  const componentId = await findComponent(tx, entry.componentName);
  if (!componentId) {
    return "rejected";
  }
  await linkComponentToDesignSystem(tx, designSystemId, componentId);
  await loadComponentStates(tx, componentId, context);

  const { appearanceId, existed } = await upsertAppearance(
    tx,
    designSystemId,
    componentId,
    entry.styleName,
  );
  const before = existed ? await snapshot(tx, appearanceId) : new Set<ValueSignature>();

  // Одна и та же пара (componentName, styleName) может встретиться в пакете дважды:
  // в `plasma_giga` это `loader/loader`. Повторная обработка стирает значения предыдущей,
  // поэтому накопленные для них ссылки нужно отменить — иначе второй проход сошлётся
  // на удалённые строки.
  await dropPendingReferencesFor(tx, appearanceId, context);
  await clearAppearanceValues(tx, appearanceId);

  const variationIds = await upsertVariations(tx, componentId, entry.config);
  const styleIds = await upsertStyles(tx, designSystemId, entry.config, variationIds);
  await declareAxes(tx, appearanceId, entry.config, variationIds, styleIds);

  const propertyIds = await findProperties(tx, componentId, entry.componentName, entry.config, context);
  await writeInvariants(tx, designSystemId, componentId, appearanceId, entry.config, propertyIds, context);
  await writeVariationValues(tx, appearanceId, entry.config, propertyIds, styleIds, variationIds, context);
  await writeComponentDeps(tx, componentId, entry.config, context);

  if (!existed) return "created";
  const after = await snapshot(tx, appearanceId);
  return sameValues(before, after) ? "unchanged" : "updated";
};

/**
 * Разрешает накопленные ссылки `component_style` в реляционную связь.
 *
 * Выполняется после импорта всех конфигураций пакета: ссылка может указывать на компонент,
 * который обрабатывается позже родителя, и его стилей на момент записи значения ещё нет.
 *
 * Ссылка вида `basic-button.size-40.mode-accent-grey` разбирается так: первый сегмент —
 * `styleName`, он переводится в компонент через состав пакета и даёт appearance; остальные
 * сегменты — имена значений осей этого компонента, они дают стили.
 */
const resolveReferences = async (
  tx: Tx,
  designSystemId: string,
  context: ImportContext,
): Promise<void> => {
  if (context.pendingReferences.length === 0) return;

  const appearanceCache = new Map<string, string | null>();
  const styleCache = new Map<string, Map<string, string>>();

  for (const pending of context.pendingReferences) {
    const [styleName, ...axisValues] = pending.reference.split(".");

    const appearanceId = await resolveTargetAppearance(
      tx,
      designSystemId,
      styleName,
      context,
      appearanceCache,
    );
    if (!appearanceId) {
      context.unresolvedComponentStyles.add(pending.reference);
      continue;
    }

    const styleIds = await resolveTargetStyles(tx, designSystemId, appearanceId, axisValues, styleCache);
    if (styleIds.length !== axisValues.length) {
      context.unresolvedComponentStyles.add(pending.reference);
      continue;
    }

    const [reference] = await tx
      .insert(schema.componentStyleReferences)
      .values({
        designSystemId,
        invariantPropertyValueId: pending.source.kind === "invariant" ? pending.source.id : null,
        variationPropertyValueId: pending.source.kind === "variation" ? pending.source.id : null,
        styleCombinationId: pending.source.kind === "combination" ? pending.source.id : null,
        targetAppearanceId: appearanceId,
        reference: pending.reference,
      })
      .returning({ id: schema.componentStyleReferences.id });

    for (const styleId of styleIds) {
      await tx
        .insert(schema.componentStyleReferenceStyles)
        .values({ referenceId: reference.id, styleId })
        .onConflictDoNothing();
    }
  }
};

/**
 * Находит appearance по имени стиля из первого сегмента ссылки.
 */
const resolveTargetAppearance = async (
  tx: Tx,
  designSystemId: string,
  styleName: string,
  context: ImportContext,
  cache: Map<string, string | null>,
): Promise<string | null> => {
  const cached = cache.get(styleName);
  if (cached !== undefined) return cached;

  const componentName = context.styleNameToComponentName.get(styleName) ?? styleName;
  const componentId = await findComponent(tx, componentName);
  if (!componentId) {
    cache.set(styleName, null);
    return null;
  }

  const [row] = await tx
    .select({ id: schema.appearances.id })
    .from(schema.appearances)
    .where(
      and(
        eq(schema.appearances.designSystemId, designSystemId),
        eq(schema.appearances.componentId, componentId),
        eq(schema.appearances.name, styleName),
      ),
    );
  const id = row?.id ?? null;
  cache.set(styleName, id);
  return id;
};

/**
 * Находит стили дочернего компонента по именам значений осей из хвоста ссылки.
 */
const resolveTargetStyles = async (
  tx: Tx,
  designSystemId: string,
  appearanceId: string,
  axisValues: string[],
  cache: Map<string, Map<string, string>>,
): Promise<string[]> => {
  if (axisValues.length === 0) return [];

  let byName = cache.get(appearanceId);
  if (!byName) {
    const rows = await tx
      .select({ id: schema.styles.id, name: schema.styles.name })
      .from(schema.styles)
      .innerJoin(schema.variations, eq(schema.variations.id, schema.styles.variationId))
      .innerJoin(schema.appearances, eq(schema.appearances.componentId, schema.variations.componentId))
      .where(
        and(
          eq(schema.appearances.id, appearanceId),
          eq(schema.styles.designSystemId, designSystemId),
        ),
      );
    byName = new Map(rows.map((row) => [row.name, row.id]));
    cache.set(appearanceId, byName);
  }

  return axisValues
    .map((value) => byName.get(value))
    .filter((id): id is string => Boolean(id));
};

/**
 * Загружает словарь состояний взаимодействия: они принадлежат модели ввода, а не компоненту,
 * и потому читаются один раз на весь импорт.
 */
const loadInteractionStates = async (tx: Tx): Promise<Map<string, string>> => {
  const rows = await tx
    .select({ id: schema.states.id, name: schema.states.name })
    .from(schema.states)
    .where(isNull(schema.states.componentId));

  return new Map(rows.map((row) => [canonical(row.name), row.id]));
};

/**
 * Разрешает набор имён состояний в идентификатор набора.
 *
 * Имя компонентного состояния ищется **только** среди состояний этого компонента: имя
 * уникально лишь внутри компонента, и запрос по одному имени вернул бы состояние чужого.
 * Именно так рождается набор, который не может наступить, — и который теперь отвергается
 * проверкой когерентности.
 *
 * Набор конструируется единственной серверной точкой — той же логикой, что стоит за
 * `POST /ds/state-sets/resolve`: канонизацию, проверку элементов и вычисление владельца
 * делает триггер на таблице.
 */
const resolveStateSet = async (
  tx: Tx,
  names: string[],
  context: ImportContext,
): Promise<string | null> => {
  const ids: string[] = [];

  for (const name of names) {
    const key = canonical(name);
    const id = context.interactionStateIds.get(key) ?? resolveComponentState(name, context);
    if (!id) return null;
    ids.push(id);
  }

  const canonicalIds = [...new Set(ids)].sort();
  const cacheKey = canonicalIds.join(",");

  const cached = context.stateSetIds.get(cacheKey);
  if (cached) return cached;

  const [existing] = await tx
    .select({ id: schema.stateSets.id })
    .from(schema.stateSets)
    .where(sql`${schema.stateSets.stateIds} = ${sql.raw(`'{${canonicalIds.join(",")}}'::uuid[]`)}`);

  if (existing) {
    context.stateSetIds.set(cacheKey, existing.id);
    return existing.id;
  }

  const [created] = await tx
    .insert(schema.stateSets)
    .values({ stateIds: canonicalIds })
    .returning({ id: schema.stateSets.id });

  context.stateSetIds.set(cacheKey, created.id);
  return created.id;
};

/**
 * Загружает семантические состояния компонента в контекст импорта.
 *
 * Их объявляет код компонента: поле `stateEnum` в `uikit-api-meta.json`. Импорт их не создаёт,
 * как не создаёт компоненты и свойства.
 */
const loadComponentStates = async (
  tx: Tx,
  componentId: string,
  context: ImportContext,
): Promise<void> => {
  context.componentStateIds.clear();

  const rows = await tx
    .select({ id: schema.states.id, name: schema.states.name })
    .from(schema.states)
    .where(eq(schema.states.componentId, componentId));

  for (const row of rows) {
    context.componentStateIds.set(canonical(row.name), row.id);
  }
};

/**
 * Разрешает имя семантического состояния в ссылку на component_states.
 */
const resolveComponentState = (name: string | null, context: ImportContext): string | null => {
  if (!name) return null;

  const id = context.componentStateIds.get(canonical(name));
  if (!id) {
    context.unknownStates.add(name);
    return null;
  }
  return id;
};

/**
 * Находит компонент в глобальном слое. Импорт его не создаёт.
 *
 * Глобальный слой — компоненты и их свойства — наполняется из `uikit-api-meta.json`
 * скриптом `scripts/import-uikit-api-meta.sh`, то есть из кода компонентов: только там есть
 * описания и платформенные алиасы, которых в конфигурациях оформления нет.
 *
 * Имена в двух источниках записаны по-разному: api-meta даёт имена Kotlin-функций
 * (`AccordionItem`), конфигурации — kebab-case (`accordion-item`). Поиск идёт по каноничной
 * форме, поэтому дубликаты не возникают.
 */
const findComponent = async (tx: Tx, name: string): Promise<string | null> => {
  const [row] = await tx
    .select({ id: schema.components.id })
    .from(schema.components)
    .where(eq(sql`lower(regexp_replace(${schema.components.name}, '[^a-zA-Z0-9]', '', 'g'))`, canonical(name)));
  return row?.id ?? null;
};

/**
 * Каноничная форма имени: нижний регистр без разделителей.
 */
const canonical = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, "");

const linkComponentToDesignSystem = async (
  tx: Tx,
  designSystemId: string,
  componentId: string,
): Promise<void> => {
  await tx
    .insert(schema.designSystemComponents)
    .values({ designSystemId, componentId })
    .onConflictDoNothing();
};

const upsertAppearance = async (
  tx: Tx,
  designSystemId: string,
  componentId: string,
  name: string,
): Promise<{ appearanceId: string; existed: boolean }> => {
  const [existing] = await tx
    .select({ id: schema.appearances.id })
    .from(schema.appearances)
    .where(
      and(
        eq(schema.appearances.designSystemId, designSystemId),
        eq(schema.appearances.componentId, componentId),
        eq(schema.appearances.name, name),
      ),
    );
  if (existing) return { appearanceId: existing.id, existed: true };

  const [created] = await tx
    .insert(schema.appearances)
    .values({ designSystemId, componentId, name })
    .returning({ id: schema.appearances.id });
  return { appearanceId: created.id, existed: false };
};

/**
 * Убирает из очереди ссылки, указывающие на значения этого appearance.
 *
 * Вызывается перед очисткой значений: строки, на которые ссылки указывают, вот-вот исчезнут.
 */
const dropPendingReferencesFor = async (
  tx: Tx,
  appearanceId: string,
  context: ImportContext,
): Promise<void> => {
  if (context.pendingReferences.length === 0) return;

  const [variationIds, invariantIds] = await Promise.all([
    tx
      .select({ id: schema.variationPropertyValues.id })
      .from(schema.variationPropertyValues)
      .where(eq(schema.variationPropertyValues.appearanceId, appearanceId)),
    tx
      .select({ id: schema.invariantPropertyValues.id })
      .from(schema.invariantPropertyValues)
      .where(eq(schema.invariantPropertyValues.appearanceId, appearanceId)),
  ]);

  const doomed = new Set([...variationIds, ...invariantIds].map((row) => row.id));
  if (doomed.size === 0) return;

  // Массив изменяется на месте: контекст пересоздаётся для каждой конфигурации,
  // и переприсваивание поля не дошло бы до общего списка.
  const kept = context.pendingReferences.filter((pending) => !doomed.has(pending.source.id));
  context.pendingReferences.length = 0;
  context.pendingReferences.push(...kept);
};

/**
 * Импорт авторитетен для пары (дизайн-система, стиль компонента), поэтому прежние значения
 * этого appearance удаляются целиком. Иначе снятые из конфигурации свойства оставались бы
 * в базе навсегда.
 */
const clearAppearanceValues = async (tx: Tx, appearanceId: string): Promise<void> => {
  await tx
    .delete(schema.variationPropertyValues)
    .where(eq(schema.variationPropertyValues.appearanceId, appearanceId));
  await tx
    .delete(schema.invariantPropertyValues)
    .where(eq(schema.invariantPropertyValues.appearanceId, appearanceId));
  await tx
    .delete(schema.styleCombinations)
    .where(eq(schema.styleCombinations.appearanceId, appearanceId));
};

const upsertVariations = async (
  tx: Tx,
  componentId: string,
  config: CommonConfig,
): Promise<Map<string, string>> => {
  const ids = new Map<string, string>();
  // Ось, встречающаяся только в пересечениях, заводится наравне с объявленными: общий формат
  // адресует ось в `targets` тем же именем, и без строки `variations` её нечем сопоставить.
  const axes = [
    ...config.variations.map((variation) => ({ id: variation.id, name: variation.name })),
    ...config.variations
      .flatMap((variation) => variation.values)
      .flatMap((value) => value.targets ?? [])
      .flatMap((target) => target.properties)
      .filter((property) => !config.variations.some((variation) => variation.id === property.id))
      .map((property) => ({ id: property.id, name: property.id })),
  ].filter((axis, index, all) => all.findIndex((entry) => entry.id === axis.id) === index);

  for (const variation of axes) {
    const [existing] = await tx
      .select({ id: schema.variations.id })
      .from(schema.variations)
      .where(
        and(
          eq(schema.variations.componentId, componentId),
          eq(schema.variations.name, variation.name),
        ),
      );
    if (existing) {
      ids.set(variation.id, existing.id);
      continue;
    }
    const [created] = await tx
      .insert(schema.variations)
      .values({ componentId, name: variation.name })
      .returning({ id: schema.variations.id });
    ids.set(variation.id, created.id);
  }
  return ids;
};

const upsertStyles = async (
  tx: Tx,
  designSystemId: string,
  config: CommonConfig,
  variationIds: Map<string, string>,
): Promise<Map<string, string>> => {
  const ids = new Map<string, string>();

  for (const [axisId, valueName] of collectAxisValues(config)) {
    const variationId = variationIds.get(axisId);
    if (!variationId) continue;

    const key = styleKey(axisId, valueName);
    if (ids.has(key)) continue;

    const [existing] = await tx
      .select({ id: schema.styles.id })
      .from(schema.styles)
      .where(
        and(
          eq(schema.styles.designSystemId, designSystemId),
          eq(schema.styles.variationId, variationId),
          eq(schema.styles.name, valueName),
        ),
      );
    if (existing) {
      ids.set(key, existing.id);
      continue;
    }
    const [created] = await tx
      .insert(schema.styles)
      .values({ designSystemId, variationId, name: valueName })
      .returning({ id: schema.styles.id });
    ids.set(key, created.id);
  }
  return ids;
};

/**
 * Все пары (ось, значение), фактически встречающиеся в конфигурации.
 *
 * Значения собираются не только из собственных значений оси, но и из `targets`:
 * ось может вообще не иметь собственных значений и фигурировать исключительно в пересечениях.
 * Так устроен `basic-button` в `sdds_sbcom`, где ось `size` встречается только как target.
 * Без этого ссылка на её стиль не разрешается, и кросс-осевое значение теряет участника.
 */
const collectAxisValues = (config: CommonConfig): Array<[string, string]> => {
  const pairs = new Set<string>();
  const add = (axisId: string, value: string) => pairs.add(`${axisId}\u0000${value}`);

  // Значения из `defaults` намеренно не добавляются: объявленный дефолт не всегда указывает
  // на существующее значение. У `basic-button` в `sdds_sbcom` ось `mode` объявляет дефолт
  // `primary`, тогда как фактические значения называются `mode-primary` и далее. Создание
  // стиля по такому дефолту породило бы значение, которого в конфигурации нет.
  //
  // Исключение — булев дефолт. Набор значений булевой оси известен по её виду и состоит ровно
  // из `true` и `false`, поэтому значение оттуда не выдумано. Без него дефолт оси, использующей
  // лишь одно из двух значений, ссылался бы в пустоту и терялся на выгрузке: `drawer-close-inner`
  // объявляет `has-shadow` с дефолтом `false`, а переопределения несёт только `true`.
  for (const entry of config.defaults) {
    if (typeof entry.value === "boolean") {
      add(entry.id, axisValueToString(entry.value));
    }
  }
  for (const variation of config.variations) {
    for (const value of variation.values) {
      add(variation.id, value.name);
      for (const target of value.targets ?? []) {
        for (const property of target.properties) {
          add(property.id, axisValueToString(property.value));
        }
      }
    }
  }
  return [...pairs].map((pair) => pair.split("\u0000") as [string, string]);
};

/**
 * Записывает объявление осей вариаций этого appearance: состав, порядок и дефолт.
 *
 * Прежде дефолт ставился флагом `styles.is_default`, уникальным по (ДС, ось), и потому
 * каждая следующая конфигурация пакета снимала его с предыдущей. Дефолт принадлежит паре
 * (appearance, ось): в корпусе 21 случай, где два стиля одного компонента в одной ДС
 * требуют разного дефолта одной оси.
 *
 * Значения оси записываются объявленными, а не использованными: значение, которому
 * не сопоставлено ни одного переопределения, остаётся частью API компонента.
 */
const declareAxes = async (
  tx: Tx,
  appearanceId: string,
  config: CommonConfig,
  variationIds: Map<string, string>,
  styleIds: Map<string, string>,
): Promise<void> => {
  // Значения, встречающиеся только в `targets`, тоже объявлены осью: `basic-button`
  // в `sdds_sbcom` использует ось `size` исключительно в пересечениях.
  const valuesByAxis = new Map<string, string[]>();
  for (const [axisId, value] of collectAxisValues(config)) {
    valuesByAxis.set(axisId, [...(valuesByAxis.get(axisId) ?? []), value]);
  }
  // Порядок значений — как в конфигурации; target-only значения идут следом.
  for (const variation of config.variations) {
    const declared = variation.values.map((value) => value.name);
    const rest = (valuesByAxis.get(variation.id) ?? []).filter((name) => !declared.includes(name));
    valuesByAxis.set(variation.id, [...declared, ...rest]);
  }

  const defaultValueByAxis = new Map(
    config.defaults.map((entry) => [entry.id, axisValueToString(entry.value)]),
  );

  // Ось, встречающаяся только в пересечениях, тоже принадлежит appearance: то же правило,
  // что и для значений. Без неё выгруженная конфигурация ссылалась бы в `targets` на ось,
  // которой не объявляет, и кодек отказался бы её собрать.
  const declaredAxisIds = config.variations.map((variation) => variation.id);
  const targetOnlyAxisIds = [...new Set(
    config.variations
      .flatMap((variation) => variation.values)
      .flatMap((value) => value.targets ?? [])
      .flatMap((target) => target.properties)
      .map((property) => property.id)
      .filter((axisId) => !declaredAxisIds.includes(axisId)),
  )];
  const axisOrder = [...declaredAxisIds, ...targetOnlyAxisIds];

  // Объявления переписываются целиком по той же причине, что и объявления координат:
  // позиция уникальна в пределах appearance, и обновление на месте сталкивалось бы само
  // с собой при смене порядка осей.
  await tx
    .delete(schema.appearanceVariations)
    .where(eq(schema.appearanceVariations.appearanceId, appearanceId));

  for (const [position, axisConfigId] of axisOrder.entries()) {
    const variation = config.variations.find((entry) => entry.id === axisConfigId)
      ?? { id: axisConfigId, name: axisConfigId, values: [] };
    const variationId = variationIds.get(variation.id);
    if (!variationId) continue;

    const defaultValue = defaultValueByAxis.get(variation.id);
    const defaultStyleId = defaultValue
      ? styleIds.get(styleKey(variation.id, defaultValue)) ?? null
      : null;

    // Роль оси цветовой схемы объявляет конфигурация, и хранится она здесь же. Прежде поле
    // отбрасывалось, а выгрузка искала ось по имени `view` — на корпусе, где она называется
    // иначе, это теряло 67 записей из 70.
    const isColorScheme = config.colorSchemeVariationId === variation.id;

    const [axis] = await tx
      .insert(schema.appearanceVariations)
      .values({
        appearanceId,
        variationId,
        position,
        defaultStyleId,
        isColorScheme,
        declaredType: variation.declaredType ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.appearanceVariations.appearanceId, schema.appearanceVariations.variationId],
        set: {
          position: sql`excluded.position`,
          defaultStyleId: sql`excluded.default_style_id`,
          isColorScheme: sql`excluded.is_color_scheme`,
          declaredType: sql`excluded.declared_type`,
        },
      })
      .returning({ id: schema.appearanceVariations.id });

    const liveStyleIds: string[] = [];
    for (const [valuePosition, name] of (valuesByAxis.get(variation.id) ?? []).entries()) {
      const styleId = styleIds.get(styleKey(variation.id, name));
      if (!styleId) continue;

      // Идентификатор значения оси берётся только у записи **без пересечений**: она и есть
      // вариация, привязанная к одной этой оси. Запись с целями описывает кросс-осевую
      // координату, её идентификатор принадлежит сочетанию и лежит в `appearance_combinations`.
      //
      // Прежде бралась первая запись с подходящим именем, и значение `bg=yes` компонента
      // `basic-button` получало `size-48` — идентификатор координаты (size-48, bg=yes).
      // На корпусах так помечались 207 значений из 1219.
      const declaredValue = variation.values.find(
        (entry) => entry.name === name && (entry.targets ?? []).length === 0,
      );
      await tx
        .insert(schema.appearanceVariationValues)
        .values({
          appearanceVariationId: axis.id,
          styleId,
          position: valuePosition,
          authoredId: declaredValue?.authoredId ?? null,
        })
        .onConflictDoUpdate({
          target: [
            schema.appearanceVariationValues.appearanceVariationId,
            schema.appearanceVariationValues.styleId,
          ],
          set: {
            position: sql`excluded.position`,
            authoredId: sql`excluded.authored_id`,
          },
        });
      liveStyleIds.push(styleId);
    }

    // Значение, снятое из конфигурации, исчезает и из объявления — тем же порядком,
    // что и значения свойств в `clearAppearanceValues`.
    await tx
      .delete(schema.appearanceVariationValues)
      .where(
        and(
          eq(schema.appearanceVariationValues.appearanceVariationId, axis.id),
          liveStyleIds.length > 0
            ? sql`${schema.appearanceVariationValues.styleId} <> ALL(${sql.raw(
                `'{${liveStyleIds.join(",")}}'::uuid[]`,
              )})`
            : sql`true`,
        ),
      );
  }

};

/**
 * Находит свойства компонента в глобальном слое. Импорт их не создаёт.
 *
 * Свойство, которого там нет, означает расхождение дизайна и кода: конфигурация задаёт
 * значение параметра, отсутствующего в `uikit-api-meta.json`. Такие имена собираются
 * в отчёт, значения для них не записываются, остальная конфигурация грузится обычным образом.
 */
/**
 * Типы, различающиеся лишь записью одного и того же значения.
 *
 * Код объявляет `integer`, конфигурация пишет `float` или `value`, а хранится всё равно
 * текстом. Такое расхождение сообщать незачем: на корпусе оно даёт пять срабатываний
 * из шести, и проверка утонула бы в них.
 */
const NUMERIC_TYPES = new Set(["integer", "float", "dimension", "value"]);

/**
 * Семейство paint: слот и вид заливки, которую он принимает.
 *
 * Слот `color` в `plasma-android` покрывает и сплошной цвет, и градиент — KSP относит
 * к нему `Color`, `Brush` и `InteractiveColor`, а модель плагина различает реализации
 * дискриминатором `type` внутри значения. Значит `gradient` в цветовом свойстве — член
 * семейства, а не расхождение с кодом.
 *
 * В корпусе оба типа принимают восемь пар «компонент + свойство», у пяти из них оба
 * встречаются внутри одной ДС и переключаются значением оси, а у `slider.thumbStrokeColor` —
 * значением состояния.
 */
const PAINT_TYPES = new Set(["color", "gradient"]);

const sameTypeFamily = (left: string, right: string): boolean =>
  left === right ||
  (NUMERIC_TYPES.has(left) && NUMERIC_TYPES.has(right)) ||
  (PAINT_TYPES.has(left) && PAINT_TYPES.has(right));

/**
 * Типы свойства, объявленные в конфигурации.
 *
 * Свойство может законно принимать несколько типов: у семи свойств корпуса тип зависит
 * от значения оси — `view=gradient` даёт градиентный токен, остальные значения цветовой.
 * Поэтому собирается множество, а не одно значение.
 */
const collectPropertyTypes = (config: CommonConfig): Map<string, Set<string>> => {
  const types = new Map<string, Set<string>>();

  const add = (name: string, type: string | undefined): void => {
    if (!type) return;
    if (!types.has(name)) types.set(name, new Set());
    types.get(name)!.add(type);
  };

  // Переопределение состояния может объявить свой тип, и он тоже объявлен конфигурацией:
  // у `slider.thumbStrokeColor` базовое значение цветовое, а `pressed` — градиентное.
  const addAll = (name: string, property: PropertyValue): void => {
    add(name, property.type);
    for (const state of property.states ?? []) add(name, state.type);
  };

  for (const [name, property] of Object.entries(config.invariants)) {
    addAll(name, property);
  }
  for (const variation of config.variations) {
    for (const value of variation.values) {
      for (const [name, property] of Object.entries(value.properties)) {
        addAll(name, property);
      }
    }
  }
  return types;
};

const findProperties = async (
  tx: Tx,
  componentId: string,
  componentName: string,
  config: CommonConfig,
  context: ImportContext,
): Promise<Map<string, string>> => {
  const rows = await tx
    .select({
      id: schema.properties.id,
      name: schema.properties.name,
      type: schema.properties.type,
    })
    .from(schema.properties)
    .where(eq(schema.properties.componentId, componentId));
  const byCanonical = new Map(rows.map((row) => [canonical(row.name), row]));

  const declaredTypes = collectPropertyTypes(config);

  const ids = new Map<string, string>();
  for (const name of collectPropertyNames(config)) {
    const row = byCanonical.get(canonical(name));
    if (!row) {
      context.unknownProperties.add(name);
      continue;
    }
    ids.set(name, row.id);

    // Виды заливки копятся по всему пакету: расхождением считается свойство, которому
    // ни один стиль не дал сплошного цвета, а не отдельный градиентный стиль.
    if (PAINT_TYPES.has(row.type)) {
      const key = `${componentName}.${name}`;
      const seen = context.paintTypesByProperty.get(key) ?? new Set<string>();
      for (const type of declaredTypes.get(name) ?? []) {
        if (PAINT_TYPES.has(type)) seen.add(type);
      }
      context.paintTypesByProperty.set(key, seen);
    }

    // Тип глобального слоя приходит из кода компонента, тип значения — из конфигурации.
    // Сообщаем, только когда тип из базы не встречается в конфигурации ни разу: иначе
    // сработало бы на свойствах, законно принимающих и цвет, и градиент.
    const declared = declaredTypes.get(name);
    if (declared && declared.size > 0) {
      const compatible = [...declared].some((type) => sameTypeFamily(type, row.type));
      if (!compatible) {
        context.typeMismatches.add(
          `${name}: global '${row.type}', config '${[...declared].sort().join("/")}'`,
        );
      }
    }
  }
  return ids;
};

/**
 * Имена всех свойств, встречающихся в конфигурации: инварианты плюс свойства всех значений
 * всех осей. Тип здесь не нужен — он принадлежит глобальному слою и приходит из api-meta.
 */
const collectPropertyNames = (config: CommonConfig): Set<string> => {
  const names = new Set<string>(Object.keys(config.invariants));
  for (const variation of config.variations) {
    for (const value of variation.values) {
      for (const name of Object.keys(value.properties)) {
        names.add(name);
      }
    }
  }
  return names;
};

const writeInvariants = async (
  tx: Tx,
  designSystemId: string,
  componentId: string,
  appearanceId: string,
  config: CommonConfig,
  propertyIds: Map<string, string>,
  context: ImportContext,
): Promise<void> => {
  const rows = new Map<string, typeof schema.invariantPropertyValues.$inferInsert>();
  const references = new Map<string, string>();
  const states = new Map<string, string[]>();

  for (const [name, property] of Object.entries(config.invariants)) {
    const propertyId = propertyIds.get(name);
    if (!propertyId) continue;

    for (const row of expandStates(property)) {
      const stateSetId = await resolveStateSet(tx, row.states, context);
      // Набор с неизвестным состоянием не создаётся: словарь ведёт код компонента,
      // а не конфигурация. Диагностика уже записана в `unknownStates`.
      if (!stateSetId) continue;

      const key = `${propertyId}|${stateSetId}`;
      rows.set(key, {
        propertyId,
        designSystemId,
        componentId,
        appearanceId,
        tokenId: resolveToken(row.token, context),
        value: row.value,
        alpha: row.alpha,
        adjustment: row.adjustment,
        position: row.position,
        stateSetId,
      });
      states.set(key, row.states);
      if (property.type === COMPONENT_STYLE && row.states.length === 0 && row.value) {
        references.set(key, row.value);
      }
    }
  }

  if (rows.size === 0) return;

  const keys = [...rows.keys()];
  const inserted = await tx
    .insert(schema.invariantPropertyValues)
    .values([...rows.values()])
    .returning({ id: schema.invariantPropertyValues.id });

  for (const [index, key] of keys.entries()) {
    const valueId = inserted[index].id;

    const reference = references.get(key);
    if (reference) {
      context.pendingReferences.push({ reference, source: { kind: "invariant", id: valueId } });
    }
  }
};

const writeVariationValues = async (
  tx: Tx,
  appearanceId: string,
  config: CommonConfig,
  propertyIds: Map<string, string>,
  styleIds: Map<string, string>,
  variationIds: Map<string, string>,
  context: ImportContext,
): Promise<void> => {
  // Одна и та же координата (свойство, стиль, состояние) может встретиться дважды: корневой
  // блок `view` и `view` внутри вариации описывают одно значение цветовой схемы. Уникальный
  // индекс это запрещает, поэтому строки собираются в отображение, где побеждает последняя.
  const rows = new Map<string, typeof schema.variationPropertyValues.$inferInsert>();
  const references = new Map<string, string>();
  const states = new Map<string, string[]>();
  const links = new Set<string>();
  const combinations: Array<{ propertyId: string; styleIds: string[]; property: PropertyValue }> = [];
  // Координаты объявляются отдельно от значений: сочетание, которому не задано ни одного
  // свойства, всё равно объявлено конфигурацией. `pagination-dots` объявляет
  // `size=m` + `active-type=line`, не переопределяя ничего.
  const declaredCombinations: Array<{
    members: string[];
    authoredId: string | null;
  }> = [];

  for (const variation of config.variations) {
    for (const value of variation.values) {
      const ownStyleId = styleIds.get(styleKey(variation.id, value.name));
      if (!ownStyleId) continue;

      const targetStyleIds = (value.targets ?? [])
        .flatMap((target) => target.properties)
        .map((target) => styleIds.get(styleKey(target.id, axisValueToString(target.value))))
        .filter((id): id is string => Boolean(id));

      if (targetStyleIds.length > 0) {
        declaredCombinations.push({
          members: [...targetStyleIds, ownStyleId],
          authoredId: value.authoredId ?? null,
        });
      }

      for (const [name, property] of Object.entries(value.properties)) {
        const propertyId = propertyIds.get(name);
        if (!propertyId) continue;

        const variationId = variationIds.get(variation.id);
        if (variationId) links.add(`${propertyId}|${variationId}`);

        if (targetStyleIds.length === 0) {
          for (const row of expandStates(property)) {
            const stateSetId = await resolveStateSet(tx, row.states, context);
            if (!stateSetId) continue;

            const key = `${propertyId}|${ownStyleId}|${stateSetId}`;
            rows.set(key, {
              propertyId,
              styleId: ownStyleId,
              appearanceId,
              tokenId: resolveToken(row.token, context),
              value: row.value,
              alpha: row.alpha,
              adjustment: row.adjustment,
              position: row.position,
              stateSetId,
            });
            states.set(key, row.states);
            if (property.type === COMPONENT_STYLE && row.states.length === 0 && row.value) {
              references.set(key, row.value);
            }
          }
        } else {
          combinations.push({ propertyId, styleIds: [...targetStyleIds, ownStyleId], property });
        }
      }
    }
  }

  if (rows.size > 0) {
    const keys = [...rows.keys()];
    const inserted = await tx
      .insert(schema.variationPropertyValues)
      .values([...rows.values()])
      .returning({ id: schema.variationPropertyValues.id });

    for (const [index, key] of keys.entries()) {
      const valueId = inserted[index].id;

      const reference = references.get(key);
      if (reference) {
        context.pendingReferences.push({ reference, source: { kind: "variation", id: valueId } });
      }
    }
  }
  for (const link of links) {
    const [propertyId, variationId] = link.split("|");
    await tx
      .insert(schema.propertyVariations)
      .values({ propertyId, variationId })
      .onConflictDoNothing();
  }
  await declareCombinations(tx, appearanceId, declaredCombinations);

  for (const combination of combinations) {
    const combinationId = await writeCombination(tx, { ...combination, appearanceId }, context);
    const value = propertyValueToText(combination.property);
    if (combinationId && combination.property.type === COMPONENT_STYLE && value) {
      context.pendingReferences.push({
        reference: value,
        source: { kind: "combination", id: combinationId },
      });
    }
  }
};

/**
 * Записывает объявления кросс-осевых координат этого appearance.
 *
 * Тот же приём, что у объявления осей: координата — факт конфигурации, а не следствие того,
 * что по ней что-то переопределено. Без отдельного объявления сочетание без свойств не
 * оставляло в модели следа, и выгрузка теряла его.
 */
const declareCombinations = async (
  tx: Tx,
  appearanceId: string,
  coordinates: Array<{ members: string[]; authoredId: string | null }>,
): Promise<void> => {
  // Объявления переписываются целиком, а не обновляются на месте. Позиция уникальна в пределах
  // appearance, и upsert сталкивался бы сам с собой: при смене порядка координат новая позиция
  // занята строкой, которую ещё предстоит подвинуть. Импорт авторитетен для appearance, поэтому
  // снести и записать заново — и проще, и вернее.
  await tx
    .delete(schema.appearanceCombinations)
    .where(eq(schema.appearanceCombinations.appearanceId, appearanceId));

  const keys = new Map<string, { members: string[]; authoredId: string | null }>();
  for (const coordinate of coordinates) {
    const members = [...new Set(coordinate.members)].sort();
    keys.set(members.join(","), { ...coordinate, members });
  }

  for (const [position, [combinationKey, coordinate]] of [...keys].entries()) {
    const [declaration] = await tx
      .insert(schema.appearanceCombinations)
      .values({
        appearanceId,
        combinationKey,
        position,
        authoredId: coordinate.authoredId,
      })
      .returning({ id: schema.appearanceCombinations.id });
    const members = coordinate.members;

    for (const [memberPosition, styleId] of members.entries()) {
      await tx
        .insert(schema.appearanceCombinationMembers)
        .values({ appearanceCombinationId: declaration.id, styleId, position: memberPosition });
    }
  }
};

/**
 * Кросс-осевое значение: одна строка сочетания плюс участники по одному на ось.
 */
const writeCombination = async (
  tx: Tx,
  input: {
    propertyId: string;
    appearanceId: string;
    styleIds: string[];
    property: PropertyValue;
  },
  context: ImportContext,
): Promise<string | null> => {
  const members = [...new Set(input.styleIds)].sort();
  const combinationKey = members.join(",");

  // Строка сочетания несёт одно значение и один набор. Прежде переопределения лежали
  // массивом в jsonb — представление вне словаря и вне ссылочной целостности, из-за
  // которого удаление состояния оставляло в базе имя несуществующего.
  const insertRow = async (row: ExpandedValue, stateSetId: string): Promise<string> => {
    const [inserted] = await tx
      .insert(schema.styleCombinations)
      .values({
        propertyId: input.propertyId,
        appearanceId: input.appearanceId,
        combinationKey,
        value: row.value ?? "",
        // Ссылка на токен, а не только его имя текстом: без неё переименование токена
        // оставляло бы в сочетании имя несуществующего, а вид заливки значения
        // выводить было бы не из чего.
        tokenId: resolveToken(row.token, context),
        alpha: row.alpha,
        adjustment: row.adjustment,
        position: row.position,
        stateSetId,
      })
      .onConflictDoUpdate({
        target: [
          schema.styleCombinations.propertyId,
          schema.styleCombinations.appearanceId,
          schema.styleCombinations.combinationKey,
          schema.styleCombinations.stateSetId,
        ],
        // Ссылка обновляется вместе со значением: иначе повторный импорт оставил бы
        // токен от прежнего значения.
        set: {
          value: sql`excluded.value`,
          tokenId: sql`excluded.token_id`,
          alpha: sql`excluded.alpha`,
          adjustment: sql`excluded.adjustment`,
          position: sql`excluded.position`,
        },
      })
      .returning({ id: schema.styleCombinations.id });

    for (const styleId of members) {
      await tx
        .insert(schema.styleCombinationMembers)
        .values({ combinationId: inserted.id, styleId })
        .onConflictDoNothing();
    }
    return inserted.id;
  };

  // Развёртка состояний общая с остальными таблицами значений: прежде здесь лежала
  // своя копия, из-за чего кросс-осевые значения теряли `alpha` и ссылку на токен.
  let baseId: string | null = null;
  for (const row of expandStates(input.property)) {
    const stateSetId = await resolveStateSet(tx, row.states, context);
    if (!stateSetId) continue;

    const id = await insertRow(row, stateSetId);
    // Ссылка `component_style` относится к базовому значению: возвращается его строка.
    if (row.states.length === 0) baseId = id;
  }

  return baseId;
};

/**
 * Ссылки `component_style` дают рёбра графа зависимостей. Первый сегмент значения —
 * имя стиля, поэтому компонент восстанавливается через состав пакета.
 */
const writeComponentDeps = async (
  tx: Tx,
  componentId: string,
  config: CommonConfig,
  context: ImportContext,
): Promise<void> => {
  const references = allProperties(config)
    .filter((property) => property.type === "component_style")
    .map((property) => propertyValueToText(property))
    .filter((value): value is string => Boolean(value));

  for (const reference of references) {
    const styleName = reference.split(".")[0];
    const childName = context.styleNameToComponentName.get(styleName) ?? styleName;

    // Имя ищется в каноничной форме по той же причине, что и имя самого компонента:
    // глобальный слой назван по коду (`BasicButton`), ссылка — по конфигурации
    // (`basic-button.size-40.mode-accent-grey`).
    const childId = await findComponent(tx, childName);
    if (!childId) {
      context.unresolvedComponentStyles.add(reference);
      continue;
    }
    const child = { id: childId };
    if (child.id === componentId) continue;

    await tx
      .insert(schema.componentDeps)
      .values({ parentId: componentId, childId: child.id, type: "reuse" })
      .onConflictDoNothing();
  }
};

interface ExpandedValue {
  value: string | null;
  token: string | null;
  /** Прозрачность значения. Хранится текстом в исходной форме. */
  alpha: string | null;
  /** Поправка для типа `shape`. Хранится текстом в исходной форме. */
  adjustment: string | null;
  /** Состояния, при которых действует значение. Пустой набор — базовое значение. */
  states: string[];
  /** Позиция в массиве `states` конфигурации: у базового значения 0, у переопределений 1..n. */
  position: number;
}

/**
 * Разворачивает свойство в строки: базовое значение плюс по строке на каждое состояние.
 */
const expandStates = (property: PropertyValue): ExpandedValue[] => {
  const rows: ExpandedValue[] = [
    {
      value: propertyValueToText(property),
      token: tokenNameOf(property),
      alpha: rawToText(property.alpha),
      adjustment: rawToText(property.adjustment),
      states: [],
      position: 0,
    },
  ];

  for (const [index, state] of (property.states ?? []).entries()) {
    const raw = state.value;

    // Набор сохраняется целиком: `["checked", "focused"]` означает «отмечен И в фокусе»,
    // и разворачивать его в отдельные строки нельзя — это превратило бы конъюнкцию
    // в независимые переопределения.
    const states = [...state.state].sort();
    if (states.length === 0) continue;

    rows.push({
      value: rawToText(raw),
      // Тип берётся у самого состояния, если оно его объявило, и только иначе
      // у базового значения. Прежде здесь всегда стоял тип родителя, и переопределение,
      // меняющее семью типов, теряло ссылку на токен вместе с типом.
      //
      // Цена ошибки — не оттенок: `plugin_theme_builder` выбирает по `states[].type`
      // группу токенов (`Theme.gradients` против `Theme.colors`), оператор альфы
      // (`asLayered` против `multiplyAlpha`) и представление базового значения.
      // При отсутствии поля плагин берёт тип базы, то есть повторяет ту же ошибку,
      // и восстановить тип на выгрузке уже неоткуда.
      token: tokenNameOf({ ...property, type: state.type ?? property.type, value: raw, default: undefined }),
      // Прозрачность переопределения своя. `adjustment` состояние не несёт —
      // общий формат объявляет его только на самом значении.
      alpha: rawToText(state.alpha),
      adjustment: null,
      states,
      // Порядок переопределений — из конфигурации: в ColorStateList выигрывает первое
      // совпадение, и сортировка по именам состояний дала бы другую тему.
      position: index + 1,
    });
  }
  return rows;
};

const resolveToken = (name: string | null, context: ImportContext): string | null => {
  if (!name) return null;
  const id = context.tokenByName.get(name);
  if (!id) {
    context.unresolvedTokens.add(name);
    return null;
  }
  return id;
};

/**
 * Снимок значений appearance для сравнения «до» и «после».
 */
const snapshot = async (tx: Tx, appearanceId: string): Promise<Set<ValueSignature>> => {
  const signatures = new Set<ValueSignature>();

  const variationRows = await tx
    .select({
      propertyId: schema.variationPropertyValues.propertyId,
      styleId: schema.variationPropertyValues.styleId,
      value: schema.variationPropertyValues.value,
      stateSetId: schema.variationPropertyValues.stateSetId,
    })
    .from(schema.variationPropertyValues)
    .where(eq(schema.variationPropertyValues.appearanceId, appearanceId));
  for (const row of variationRows) {
    signatures.add(`v|${row.propertyId}|${row.styleId}|${row.value}|${row.stateSetId}`);
  }

  const invariantRows = await tx
    .select({
      propertyId: schema.invariantPropertyValues.propertyId,
      value: schema.invariantPropertyValues.value,
      stateSetId: schema.invariantPropertyValues.stateSetId,
    })
    .from(schema.invariantPropertyValues)
    .where(eq(schema.invariantPropertyValues.appearanceId, appearanceId));
  for (const row of invariantRows) {
    signatures.add(`i|${row.propertyId}|${row.value}|${row.stateSetId}`);
  }

  const combinationRows = await tx
    .select({
      propertyId: schema.styleCombinations.propertyId,
      combinationKey: schema.styleCombinations.combinationKey,
      value: schema.styleCombinations.value,
    })
    .from(schema.styleCombinations)
    .where(eq(schema.styleCombinations.appearanceId, appearanceId));
  for (const row of combinationRows) {
    signatures.add(`c|${row.propertyId}|${row.combinationKey}|${row.value}`);
  }

  return signatures;
};

const sameValues = (before: Set<ValueSignature>, after: Set<ValueSignature>): boolean => {
  if (before.size !== after.size) return false;
  for (const signature of before) {
    if (!after.has(signature)) return false;
  }
  return true;
};

const styleKey = (variationId: string, valueName: string): string => `${variationId} ${valueName}`;
