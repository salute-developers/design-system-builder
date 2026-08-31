import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/index";
import { deriveValueType, placeValue, restoreJsonType } from "../../db/export/valueType";
import {
  designSystems,
  designSystemVersions,
  components,
  appearances,
  appearanceVariations,
  appearanceVariationValues,
  variations,
  styles,
  invariantPropertyValues,
  variationPropertyValues,
  styleCombinations,
  styleCombinationMembers,
  properties,
  tokens,
  states,
  stateSets,
} from "../../db/schema";
import {
  assertFound,
  designSystemBelongsToScope,
  tryCatch,
} from "./utils";

const router = Router();

// Корневая вариация и вариация-цветовая схема определяются эвристикой по имени.
// TODO: если появится явный признак в схеме (флаг/ссылка) — брать оттуда.
const ROOT_VARIATION_NAME = "size";
const COLOR_SCHEME_VARIATION_NAME = "view";

// Значение свойства в конфиге. Ключом в map выступает имя property, а id
// кладётся отдельным полем.
//
// `type` — тип **значения**, а не слота, и словарь у него свой: он шире
// `propertyTypeEnum` на `gradient` и уже на `integer`. Поэтому строка, а не enum схемы:
// перечисление описывает тип слота API компонента, а `gradient` различает конкретное
// значение внутри семейства paint. Полный словарь — `VALUE_TYPES` в
// `db/import/componentImport.ts`.
type PropEntry = {
  id: string;
  type: string;
  /** Значение цвета и градиента; у остальных типов поля нет. */
  default?: unknown;
  /** Значение всех прочих типов; у цвета и градиента поля нет. */
  value?: unknown;
  states: { state: string[]; value: unknown; type?: string }[];
};

/**
 * GET /ds/component-config?ds=&version=&appearance=&component=
 *
 * Возвращает конфиг одного компонента в рамках дизайн-системы / апперанса
 * в формате, который потребляет дизайн-система.
 *
 * TODO: версия (`version`) сейчас требуется в запросе, но конфиг собирается
 * из текущего состояния БД, а не из снапшота. Рассмотреть вариант доставать
 * готовый конфиг из designSystemVersions.snapshot по версии.
 */
router.get("/", (req, res) =>
  tryCatch(res, async () => {
    const dsName = req.query.ds;
    const version = req.query.version;
    const appearanceName = req.query.appearance;
    const componentName = req.query.component;

    if (
      typeof dsName !== "string" ||
      typeof version !== "string" ||
      typeof appearanceName !== "string" ||
      typeof componentName !== "string"
    ) {
      res.status(400).json({
        error: "Query params required: ds, version, appearance, component",
      });
      return;
    }

    // ── Design system ────────────────────────────────────────────────────────
    const [ds] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.name, dsName));

    if (!assertFound(ds, res)) return;
    if (!designSystemBelongsToScope(ds, req)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // TODO: использовать версию. Сейчас version принимается, но игнорируется —
    // конфиг берётся из текущего состояния. Когда появится версионирование —
    // доставать снапшот из designSystemVersions по (ds.id, version).
    void version;
    void designSystemVersions;

    // ── Component ──────────────────────────────────────────────────────────────
    const [component] = await db
      .select()
      .from(components)
      .where(eq(components.name, componentName));

    if (!assertFound(component, res)) return;

    // ── Appearance ─────────────────────────────────────────────────────────────
    const [appearance] = await db
      .select()
      .from(appearances)
      .where(
        and(
          eq(appearances.designSystemId, ds.id),
          eq(appearances.componentId, component.id),
          eq(appearances.name, appearanceName),
        ),
      );

    if (!assertFound(appearance, res)) return;

    // ── Variations / properties ────────────────────────────────────────────────
    const [variationRows, propertyRows] = await Promise.all([
      db.select().from(variations).where(eq(variations.componentId, component.id)),
      db.select().from(properties).where(eq(properties.componentId, component.id)),
    ]);

    const variationIds = variationRows.map((v) => v.id);
    const propById = new Map(propertyRows.map((p) => [p.id, p]));

    // ── Styles ──────────────────────────────────────────────────────────────────
    const styleRows =
      variationIds.length > 0
        ? await db
            .select()
            .from(styles)
            .where(
              and(
                eq(styles.designSystemId, ds.id),
                inArray(styles.variationId, variationIds),
              ),
            )
        : [];

    const styleIds = styleRows.map((s) => s.id);
    const styleById = new Map(styleRows.map((s) => [s.id, s]));

    // ── VPV / IPV ────────────────────────────────────────────────────────────────
    const [vpvRows, ipvRows] = await Promise.all([
      styleIds.length > 0
        ? db
            .select()
            .from(variationPropertyValues)
            .where(
              and(
                inArray(variationPropertyValues.styleId, styleIds),
                eq(variationPropertyValues.appearanceId, appearance.id),
              ),
            )
        : Promise.resolve([] as (typeof variationPropertyValues.$inferSelect)[]),
      db
        .select()
        .from(invariantPropertyValues)
        .where(
          and(
            eq(invariantPropertyValues.designSystemId, ds.id),
            eq(invariantPropertyValues.componentId, component.id),
            eq(invariantPropertyValues.appearanceId, appearance.id),
          ),
        ),
    ]);

    // ── Наборы состояний ────────────────────────────────────────────────────────
    // Wire-контракт не меняется: наружу набор по-прежнему уходит списком имён. Хранится он
    // теперь ссылкой, поэтому имена собираются здесь, одним запросом на всю конфигурацию.
    //
    // Имена сортируются: порядок элементов в массиве набора канонический, но имена берутся
    // джойном, а у него без ORDER BY порядок не определён — сравнение двух выгрузок ломалось
    // бы на перестановке.
    const stateNamesBySetId = new Map<string, string[]>();

    // ── Style combinations (targets / пересечения вариаций) ────────────────────
    const propertyIds = propertyRows.map((p) => p.id);
    const combinationRows =
      propertyIds.length > 0
        ? await db
            .select()
            .from(styleCombinations)
            .where(
              and(
                eq(styleCombinations.appearanceId, appearance.id),
                inArray(styleCombinations.propertyId, propertyIds),
              ),
            )
        : [];

    const combinationIds = combinationRows.map((c) => c.id);
    const memberRows =
      combinationIds.length > 0
        ? await db
            .select()
            .from(styleCombinationMembers)
            .where(inArray(styleCombinationMembers.combinationId, combinationIds))
        : [];

    // combinationId -> styleIds комбинации; styleId -> combinationIds стиля
    const stylesByCombination = new Map<string, string[]>();
    const combinationsByStyle = new Map<string, string[]>();
    for (const m of memberRows) {
      if (!stylesByCombination.has(m.combinationId))
        stylesByCombination.set(m.combinationId, []);
      stylesByCombination.get(m.combinationId)!.push(m.styleId);

      if (!combinationsByStyle.has(m.styleId))
        combinationsByStyle.set(m.styleId, []);
      combinationsByStyle.get(m.styleId)!.push(m.combinationId);
    }

    // ── Резолв значений (value либо имя токена) ─────────────────────────────────
    const referencedTokenIds = [
      ...new Set(
        [...vpvRows.map((r) => r.tokenId), ...ipvRows.map((r) => r.tokenId)].filter(
          Boolean,
        ) as string[],
      ),
    ];
    // Вместе с именем берётся тип токена: им выводится вид заливки значения.
    const tokenById =
      referencedTokenIds.length > 0
        ? new Map(
            (
              await db
                .select({ id: tokens.id, name: tokens.name, type: tokens.type })
                .from(tokens)
                .where(inArray(tokens.id, referencedTokenIds))
            ).map((t) => [t.id, t]),
          )
        : new Map<string, { id: string; name: string; type: string | null }>();

    const resolveValue = (
      value: string | null,
      tokenId: string | null,
    ): string | null =>
      value ?? (tokenId ? tokenById.get(tokenId)?.name ?? null : null);

    const tokenTypeOf = (tokenId: string | null): string | null =>
      tokenId ? tokenById.get(tokenId)?.type ?? null : null;

    // ── Helpers ───────────────────────────────────────────────────────────────
    function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
      const map = new Map<string, T[]>();
      for (const item of arr) {
        const k = key(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(item);
      }
      return map;
    }

    const stylesByVariationId = groupBy(styleRows, (s) => s.variationId);
    const vpvByStyleId = groupBy(vpvRows, (v) => v.styleId);

    /**
     * Свойства (propertyName -> { id, type, value, states }) из строк *PropertyValues.
     * Ключ — имя property, его id лежит в поле `id`.
     * Базовое значение — строка с state IS NULL, остальные складываются в states[].
     */
    {
      const setIds = [
        ...new Set([
          ...vpvRows.map((r) => r.stateSetId),
          ...ipvRows.map((r) => r.stateSetId),
          ...combinationRows.map((r) => r.stateSetId),
        ]),
      ];

      if (setIds.length > 0) {
        const rows = await db
          .select({ setId: stateSets.id, name: states.name })
          .from(stateSets)
          .innerJoin(states, sql`${states.id} = ANY(${stateSets.stateIds})`)
          .where(inArray(stateSets.id, setIds));

        for (const row of rows) {
          const names = stateNamesBySetId.get(row.setId) ?? [];
          names.push(row.name);
          stateNamesBySetId.set(row.setId, names);
        }
        for (const names of stateNamesBySetId.values()) names.sort();
      }
    }

    const stateNamesOf = (setId: string): string[] => stateNamesBySetId.get(setId) ?? [];

    function buildProperties(
      rows: {
        propertyId: string;
        value: string | null;
        tokenId: string | null;
        // Канонический ключ набора состояний: пустая строка у базового значения,
        // иначе имена через запятую. Значение может действовать при нескольких
        // состояниях сразу, поэтому одной колонкой набор не выражается.
        stateNames: string[];
      }[],
    ): Record<string, PropEntry> {
      const byPropId = groupBy(rows, (r) => r.propertyId);
      const result: Record<string, PropEntry> = {};

      for (const [propertyId, propRows] of byPropId) {
        const prop = propById.get(propertyId);
        const base = propRows.find((r) => r.stateNames.length === 0);
        const stateRows = propRows.filter((r) => r.stateNames.length > 0);

        // Ключ — имя property; фолбэк на id, если имя почему-то недоступно.
        const key = prop?.name ?? propertyId;

        // Тип слота приходит из кода компонента и покрывает семейство целиком; какой
        // заливкой оказалось значение, знает его токен. Прежде здесь отдавался слот,
        // и градиент уходил потребителю сплошным цветом.
        const slot = prop?.type ?? "value";
        const type = deriveValueType(slot, base ? tokenTypeOf(base.tokenId) : null);
        const rawValue = base ? resolveValue(base.value, base.tokenId) : null;

        result[key] = {
          id: propertyId,
          type,
          // Цвет и градиент модель плагина ждёт в `default`, остальные типы — в `value`.
          ...placeValue(type, restoreJsonType(rawValue, type)),
          states: stateRows.map((sr) => {
            const stateType = deriveValueType(slot, tokenTypeOf(sr.tokenId));
            return {
              state: sr.stateNames,
              value: restoreJsonType(resolveValue(sr.value, sr.tokenId), stateType),
              // Тип пишется только при расхождении с базой: при его отсутствии
              // потребитель берёт тип базового значения.
              ...(stateType !== type ? { type: stateType } : {}),
            };
          }),
        };
      }

      return result;
    }

    // ── invariants ──────────────────────────────────────────────────────────────
    const invariants = buildProperties(
      ipvRows.map((r) => ({
        propertyId: r.propertyId,
        value: r.value,
        tokenId: r.tokenId,
        stateNames: stateNamesOf(r.stateSetId),
      })),
    );

    // ── root / colorScheme variation ──────────────────────────────────────────
    // Ссылаться можно только на ось, попавшую в ответ.
    // ── объявление осей этого appearance ───────────────────────────────────────
    //
    // Оси берутся из объявления, а не выводятся из наличия стилей в дизайн-системе.
    // Прежний вывод давал фантомные оси: стиль оси существует в ДС, потому что его
    // завёл другой appearance того же компонента, — и ось попадала в ответ с пустым
    // набором значений. `avatar-indicator` так получал ось `view`, которой не имеет.
    const declaredAxisRows = await db
      .select({
        axisId: appearanceVariations.id,
        variationId: appearanceVariations.variationId,
        position: appearanceVariations.position,
      })
      .from(appearanceVariations)
      .where(eq(appearanceVariations.appearanceId, appearance.id))
      .orderBy(appearanceVariations.position);

    const declaredValueRows = declaredAxisRows.length
      ? await db
          .select({
            axisId: appearanceVariationValues.appearanceVariationId,
            styleId: appearanceVariationValues.styleId,
            position: appearanceVariationValues.position,
          })
          .from(appearanceVariationValues)
          .where(
            inArray(
              appearanceVariationValues.appearanceVariationId,
              declaredAxisRows.map((row) => row.axisId),
            ),
          )
          .orderBy(appearanceVariationValues.position)
      : [];

    const declaredStylesByVariationId = new Map<string, typeof styleRows>();
    const axisIdToVariationId = new Map(
      declaredAxisRows.map((row) => [row.axisId, row.variationId]),
    );
    for (const row of declaredValueRows) {
      const variationId = axisIdToVariationId.get(row.axisId);
      const style = styleById.get(row.styleId);
      if (!variationId || !style) continue;

      declaredStylesByVariationId.set(variationId, [
        ...(declaredStylesByVariationId.get(variationId) ?? []),
        style,
      ]);
    }

    // Порядок осей — из объявления, а не из порядка строк `variations`.
    const declaredVariations = declaredAxisRows.flatMap((row) => {
      const variation = variationRows.find((entry) => entry.id === row.variationId);
      return variation ? [variation] : [];
    });

    const filledVariations = declaredVariations;
    const rootVariationId =
      filledVariations.find((v) => v.name === ROOT_VARIATION_NAME)?.id ?? null;
    const colorSchemeVariationId =
      filledVariations.find((v) => v.name === COLOR_SCHEME_VARIATION_NAME)?.id ?? null;

    // ── defaults (дефолтное значение каждой оси) ───────────────────────────────
    //
    // Дефолт принадлежит паре (appearance, ось), а не стилю: два стиля одного компонента
    // в одной ДС могут требовать разного дефолта одной оси. Прежде читался флаг
    // `styles.is_default`, уникальный по (ДС, ось), и потому отдавал один дефолт всем
    // стилям компонента.
    const defaultStyleRows = await db
      .select({
        variationId: appearanceVariations.variationId,
        styleName: styles.name,
      })
      .from(appearanceVariations)
      .innerJoin(styles, eq(appearanceVariations.defaultStyleId, styles.id))
      .where(eq(appearanceVariations.appearanceId, appearance.id));

    const defaultStyleByVariationId = new Map(
      defaultStyleRows.map((row) => [row.variationId, row.styleName]),
    );

    const defaults = declaredVariations.flatMap((variation) => {
      const value = defaultStyleByVariationId.get(variation.id);
      return value ? [{ id: variation.id, value }] : [];
    });

    // ── variations ────────────────────────────────────────────────────────────
    //
    // Состав, порядок и значения осей берутся из объявления этого appearance.
    // Объявленное значение остаётся в ответе, даже если оформление его не трогает:
    // иначе оно исчезло бы из API компонента.
    const variationsConfig = declaredVariations
      .map((variation) => {
      const varStyles = declaredStylesByVariationId.get(variation.id) ?? [];

        // Сочетание принадлежит ровно одному стилю-участнику, иначе оно попало бы
      // в ответ столько раз, сколько в нём осей. Владельца выбираем детерминированно:
      // ось цветовой схемы, если она в сочетании есть, иначе наименьший styleId.
      // Какой именно участник назначен владельцем, на восстановление конфигурации
      // не влияет: координата владельца и targets в сумме дают тот же набор осей.
      const ownerOf = (combinationId: string): string | null => {
        const members = stylesByCombination.get(combinationId) ?? [];
        if (members.length === 0) return null;

        const scheme = members.find(
          (sid) => styleById.get(sid)?.variationId === colorSchemeVariationId,
        );
        return scheme ?? [...members].sort()[0];
      };

      const values = varStyles.flatMap((style) => {
        // targets: для каждой комбинации, в которую входит стиль, перечисляем
        // остальные стили-члены как пересечения {variationId, styleName}.
        // Значения, зависящие только от этой оси.
        const base = {
          name: style.name,
          properties: buildProperties(
            (vpvByStyleId.get(style.id) ?? []).map((v) => ({
              propertyId: v.propertyId,
              value: v.value,
              tokenId: v.tokenId,
              stateNames: stateNamesOf(v.stateSetId),
            })),
          ),
        };

        // Значения, зависящие от нескольких осей сразу. Сочетания с одинаковым
        // набором координат объединяются в одну запись: их различает свойство,
        // а не координата.
        const byCoordinates = new Map<
          string,
          { targets: { id: string; value: string }[]; rows: typeof combinationRows }
        >();

        for (const combinationId of combinationsByStyle.get(style.id) ?? []) {
          if (ownerOf(combinationId) !== style.id) continue;

          const coordinates = (stylesByCombination.get(combinationId) ?? [])
            .filter((sid) => sid !== style.id)
            .map((sid) => {
              const memberStyle = styleById.get(sid);
              return {
                id: memberStyle?.variationId ?? sid,
                value: memberStyle?.name ?? "",
              };
            })
            .sort((a, b) => a.id.localeCompare(b.id));

          const key = coordinates.map((c) => `${c.id}=${c.value}`).join("|");
          if (!byCoordinates.has(key)) {
            byCoordinates.set(key, { targets: coordinates, rows: [] });
          }
          byCoordinates.get(key)!.rows.push(
            ...combinationRows.filter((c) => c.id === combinationId),
          );
        }

        const crossAxis = [...byCoordinates.values()].map((group) => ({
          name: style.name,
          targets: [{ properties: group.targets }],
          properties: buildProperties(
            group.rows.map((c) => ({
              propertyId: c.propertyId,
              value: c.value,
              // У сочетаний нет ссылки на токен: имя токена лежит в value как текст.
              tokenId: null,
              stateNames: stateNamesOf(c.stateSetId),
            })),
          ),
        }));

        return [base, ...crossAxis];
      });

      return {
        id: variation.id,
        name: variation.name,
        values,
      };
    });

    res.json({
      rootVariationId,
      colorSchemeVariationId,
      invariants,
      defaults,
      variations: variationsConfig,
    });
  }),
);

export default router;
