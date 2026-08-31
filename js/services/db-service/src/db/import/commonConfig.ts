import { z } from "zod";

/**
 * Общий формат конфигурации компонента, который присылает `dsbuilder components push`.
 *
 * Форма описана по common_config_scheme.json репозитория theme-converter. Тип свойства
 * принадлежит значению, а не определению: одно и то же свойство принимает `color` и
 * `gradient` в зависимости от значения оси, поэтому здесь он не сводится к одному типу.
 */
export const PropertyStateSchema = z.object({
  state: z.array(z.string()).default([]),
  value: z.unknown().optional(),
  alpha: z.unknown().optional(),
  type: z.string().optional(),
});

export const PropertyValueSchema = z.object({
  type: z.string(),
  value: z.unknown().optional(),
  default: z.unknown().optional(),
  alpha: z.unknown().optional(),
  adjustment: z.unknown().optional(),
  states: z.array(PropertyStateSchema).optional(),
});

export const TargetPropertySchema = z.object({
  id: z.string(),
  value: z.unknown(),
});

export const TargetSchema = z.object({
  properties: z.array(TargetPropertySchema).default([]),
});

export const VariationValueSchema = z.object({
  name: z.string(),
  // Идентификатор вариации, написанный автором конфигурации. Правила сборки у него нет,
  // вывести нельзя, а плагин строит из него имя генерируемого стиля.
  //
  // Родитель здесь не возится: он выводится как самый длинный точечный префикс
  // идентификатора, принадлежащий другой вариации.
  authoredId: z.string().optional(),
  targets: z.array(TargetSchema).optional(),
  properties: z.record(z.string(), PropertyValueSchema).default({}),
});

export const VariationSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.array(VariationValueSchema).default([]),
  // Тип оси, объявленный конфигурацией. Возится отдельно от роли: роль говорит, куда уезжают
  // значения, тип — как ось объявлена, и в `sdds_sbcom` они расходятся у 10 осей.
  declaredType: z.string().nullish(),
});

export const CommonConfigSchema = z.object({
  rootVariationId: z.string().nullish(),
  colorSchemeVariationId: z.string().nullish(),
  invariants: z.record(z.string(), PropertyValueSchema).default({}),
  defaults: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .default([]),
  variations: z.array(VariationSchema).default([]),
});

export const ImportComponentSchema = z.object({
  componentName: z.string().min(1),
  styleName: z.string().min(1),
  config: CommonConfigSchema,
});

export const ImportRequestSchema = z.object({
  // Дизайн-система адресуется телом, а не путём: так же принимают designSystemId
  // остальные POST-ручки этого API, и идентификатор проверяется до запроса в базу.
  designSystemId: z.string().uuid(),
  meta: z.object({
    name: z.string(),
    source: z.string().default(""),
  }),
  dryRun: z.boolean().default(true),
  components: z.array(ImportComponentSchema).min(1),
});

export const ExportRequestSchema = z.object({
  // Дизайн-система адресуется телом так же, как у `/import`: путь остаётся без параметров,
  // а идентификатор проверяется на uuid вместе с остальным телом.
  designSystemId: z.string().uuid(),
});

export type PropertyValue = z.infer<typeof PropertyValueSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type VariationValue = z.infer<typeof VariationValueSchema>;
export type CommonConfig = z.infer<typeof CommonConfigSchema>;
export type ImportComponent = z.infer<typeof ImportComponentSchema>;
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

/**
 * Приводит значение оси к строке так же, как это делает CLI: общий формат именует
 * значение строкой, тогда как исходные данные хранят на осях типа boolean настоящие
 * JSON-були.
 */
export const axisValueToString = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

/**
 * Типы, значение которых ссылается на токен дизайн-системы.
 *
 * Остальные строковые значения токенами не являются: `component_style` ссылается на стиль
 * другого компонента, `icon` и `value` несут литералы.
 */
const TOKEN_BACKED_TYPES = new Set(["color", "gradient", "typography", "shape", "shadow"]);

/**
 * Возвращает имя токена, на который ссылается значение свойства, либо `null`.
 *
 * Токен несут поля `default` (цвет и градиент) и `value` (типография, форма, тень).
 */
export const tokenNameOf = (property: PropertyValue): string | null => {
  if (!TOKEN_BACKED_TYPES.has(property.type)) return null;
  const raw = property.default ?? property.value;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
};

/**
 * Сериализует произвольное значение конфигурации в текст.
 *
 * Форма сохраняется как есть: `0.2` остаётся `0.2`, а не превращается в `0.20`. Значение
 * возвращается в конфигурацию тем же текстом, поэтому нормализация здесь означала бы
 * расхождение выгруженного конфига с исходным.
 */
export const rawToText = (raw: unknown): string | null => {
  if (raw === undefined || raw === null) return null;
  return typeof raw === "string" ? raw : JSON.stringify(raw);
};

/**
 * Сериализует значение свойства в текст для колонки `value`.
 */
export const propertyValueToText = (property: PropertyValue): string | null =>
  rawToText(property.default ?? property.value);
