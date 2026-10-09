import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../schema";
import { camelToKebab } from "./componentExport";

/**
 * Web-адаптер: данные web-генерации пакета, которых нет в выгрузке конфигураций.
 *
 * Временное решение, мост из базы до постоянных источников (постоянный — `web-api-meta.json`
 * из аннотаций токенов). Локальная генерация (`js/cli`) собирает пакет из выгрузки
 * `components fetch` и `web-api-meta.json`, но шаблоны web-параметров зависят от дизайн-системы,
 * compose-связи нужны раскладке пакета, а имя и описание компонента живут в базе. В общий ответ
 * `/export` всё это не входит: формат конфигураций общий для платформ. Ответ CLI сохраняет как
 * есть в `.sdds/web/web-adapter.json`; удалить решение — значит удалить этот модуль, ручку
 * и адаптер CLI.
 */

/** Шаблоны одной конфигурации: свойство -> web-параметр -> шаблон. */
export type StyleTemplates = Record<string, Record<string, string>>;

/**
 * Данные одного компонента. Пустые поля не пишутся.
 *
 * @property componentName имя в написании `meta.json` (`icon-tab-item`), по нему CLI сопоставляет
 *   запись с конфигурациями.
 * @property name имя компонента в коде (`IconTabItem`), как в базе.
 * @property description описание компонента для JSDoc обёртки.
 * @property compose дочерние компоненты в написании `meta.json`, в порядке связи.
 * @property styles шаблоны по стилям (appearance), только у стилей, где они есть.
 */
export interface WebAdapterComponent {
  componentName: string;
  name: string;
  description?: string;
  compose?: string[];
  styles?: Record<string, { templates: StyleTemplates }>;
}

/**
 * Содержимое `web-adapter.json`: компоненты пакета по `componentName`. Массив, как и соседний
 * `web-api-meta.json`.
 */
export type WebAdapter = WebAdapterComponent[];

interface ExportedTemplates {
  componentName: string;
  styleName: string;
  web: StyleTemplates;
}

type Appearance = {
  appearanceId: string;
  appearanceName: string | null;
  componentId: string;
  componentName: string;
  componentDescription: string | null;
};

/** Собирает web-адаптер по конфигурациям дизайн-системы. */
export const buildWebAdapter = async (db: any, designSystemId: string): Promise<WebAdapter> => {
  // Состав тот же, что у выгрузки: компоненты, у которых в дизайн-системе есть appearance.
  const appearances: Appearance[] = await db
    .select({
      appearanceId: schema.appearances.id,
      appearanceName: schema.appearances.name,
      componentId: schema.components.id,
      componentName: schema.components.name,
      componentDescription: schema.components.description,
    })
    .from(schema.appearances)
    .innerJoin(schema.components, eq(schema.appearances.componentId, schema.components.id))
    .where(eq(schema.appearances.designSystemId, designSystemId));

  if (appearances.length === 0) {
    return [];
  }

  const templates = await loadWebTemplates(db, appearances);
  const compose = await loadComposeDependencies(db, appearances);

  const components: Record<string, WebAdapterComponent> = {};
  // Ключи сортируются: ответ должен быть детерминирован, иначе повторный fetch даёт дифф.
  const sorted = [...appearances].sort((left, right) => left.componentName.localeCompare(right.componentName));
  for (const appearance of sorted) {
    const key = camelToKebab(appearance.componentName);
    if (components[key]) continue;
    components[key] = {
      componentName: key,
      name: appearance.componentName,
      ...(appearance.componentDescription ? { description: appearance.componentDescription } : {}),
      ...(compose[key] ? { compose: compose[key] } : {}),
    };
  }

  const byStyle = (left: ExportedTemplates, right: ExportedTemplates) => left.styleName.localeCompare(right.styleName);
  for (const entry of [...templates].sort(byStyle)) {
    const component = components[entry.componentName];
    component.styles = { ...component.styles, [entry.styleName]: { templates: entry.web } };
  }

  // Порядок детерминирован: по `componentName`, как ключи выше.
  return Object.values(components).sort((left, right) => left.componentName.localeCompare(right.componentName));
};

/**
 * Шаблоны web-параметров по appearance.
 *
 * Шаблон хранится на строке поправки, то есть на конкретном значении, но описывает
 * параметр целиком: внутри appearance у пары (свойство, параметр) он один. Расходящиеся
 * шаблоны выразить в ответе нечем, поэтому берётся наименьший: выбор детерминирован,
 * и повторная выгрузка не даёт диффа.
 */
const loadWebTemplates = async (
  db: any,
  appearances: Array<{ appearanceId: string; appearanceName: string | null; componentName: string }>,
): Promise<ExportedTemplates[]> => {
  const appearanceIds = appearances.map((row) => row.appearanceId);
  const select = (adjustments: any, values: any, valueId: any) =>
    db
      .select({
        appearanceId: values.appearanceId,
        propertyName: schema.properties.name,
        paramName: schema.propertyPlatformParams.name,
        template: adjustments.template,
      })
      .from(adjustments)
      .innerJoin(schema.propertyPlatformParams, eq(adjustments.platformParamId, schema.propertyPlatformParams.id))
      .innerJoin(values, eq(valueId, values.id))
      .innerJoin(schema.properties, eq(values.propertyId, schema.properties.id))
      .where(
        and(
          inArray(values.appearanceId, appearanceIds),
          eq(schema.propertyPlatformParams.platform, "web"),
          sql`${adjustments.template} IS NOT NULL`,
        ),
      );

  const rows = [
    ...(await select(
      schema.variationPlatformParamAdjustments,
      schema.variationPropertyValues,
      schema.variationPlatformParamAdjustments.vpvId,
    )),
    ...(await select(
      schema.invariantPlatformParamAdjustments,
      schema.invariantPropertyValues,
      schema.invariantPlatformParamAdjustments.ipvId,
    )),
  ];

  const byAppearance = new Map<string, Record<string, Record<string, string>>>();
  for (const row of rows) {
    const web = byAppearance.get(row.appearanceId) ?? {};
    const params = (web[row.propertyName] ??= {});
    const current = params[row.paramName];
    if (current === undefined || row.template < current) params[row.paramName] = row.template;
    byAppearance.set(row.appearanceId, web);
  }

  // Ключи сортируются: порядок строк из базы не определён, а ответ должен быть детерминирован.
  const sorted = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

  return appearances.flatMap((appearance) => {
    const web = byAppearance.get(appearance.appearanceId);
    if (!web) return [];
    return [
      {
        componentName: camelToKebab(appearance.componentName),
        styleName: appearance.appearanceName ?? "default",
        web: sorted(Object.fromEntries(Object.entries(web).map(([property, params]) => [property, sorted(params)]))),
      },
    ];
  });
};

/**
 * Дочерние компоненты `compose`: родитель -> дети в порядке связи.
 *
 * Связь глобальная, а не принадлежит дизайн-системе, поэтому отдаётся только между
 * компонентами пакета: ребёнок, которого в пакете нет, генератору раскладывать незачем.
 */
const loadComposeDependencies = async (
  db: any,
  appearances: Array<{ componentId: string; componentName: string }>,
): Promise<Record<string, string[]>> => {
  const nameById = new Map(appearances.map((row) => [row.componentId, row.componentName]));
  const componentIds = [...nameById.keys()];

  const rows = await db
    .select({
      parentId: schema.componentDeps.parentId,
      childId: schema.componentDeps.childId,
      order: schema.componentDeps.order,
    })
    .from(schema.componentDeps)
    .where(
      and(
        eq(schema.componentDeps.type, "compose"),
        inArray(schema.componentDeps.parentId, componentIds),
        inArray(schema.componentDeps.childId, componentIds),
      ),
    );

  const childrenByParent = new Map<string, Array<{ name: string; order: number | null }>>();
  for (const row of rows) {
    const parent = camelToKebab(nameById.get(row.parentId)!);
    childrenByParent.set(parent, [
      ...(childrenByParent.get(parent) ?? []),
      { name: camelToKebab(nameById.get(row.childId)!), order: row.order },
    ]);
  }

  return Object.fromEntries(
    [...childrenByParent.keys()].sort().map((parent) => [
      parent,
      childrenByParent
        .get(parent)!
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.name.localeCompare(right.name))
        .map((child) => child.name),
    ]),
  );
};

