import { z } from "zod";
import * as schema from "../schema";

/**
 * Манифест API-меты компонентов, который присылает `dsbuilder components import-api`.
 *
 * Формат исходной меты платформы (`stateEnum`, `group`, `paramSimpleType`, `attrName`)
 * сюда не попадает: его разбирает CLI, а backend получает уже готовые компоненты, свойства
 * и состояния. Так добавление новой платформы не требует нового разборщика на этой стороне.
 *
 * Тип свойства здесь строка, а не перечисление: список допустимых значений принадлежит
 * `propertyTypeEnum`, и проверяет его запись, чтобы неизвестный тип вернулся в `rejected`,
 * а не оборвал весь запрос ошибкой валидации.
 */
export const ApiMetaDeprecationSchema = z.object({
  // Сообщение может быть пустым: пометка без текста всё равно означает «устарело».
  message: z.string(),
});

// Платформенное имя: строка («сведений об устаревании нет», так шлют прежние CLI) либо объект.
// Объект без `deprecated` явно говорит «не устарело» и потому может снять прежнюю пометку.
export const ApiMetaPlatformNameSchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    deprecated: ApiMetaDeprecationSchema.optional(),
  }),
]);

export const ApiMetaPropertySchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    // Имена свойства на платформе запроса: у Compose это `id`, у View — XML-атрибуты. Имён может
    // быть несколько (`Avatar.width` у View — `android:minWidth` и `android:maxWidth`).
    platformNames: z.array(ApiMetaPlatformNameSchema).min(1).optional(),
    // Прежнее поле одного имени: принимается, чтобы не ломать уже выпущенные CLI.
    platformName: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .refine((property) => property.platformNames !== undefined || property.platformName !== undefined, {
    message: "platformNames (or the legacy platformName) is required",
    path: ["platformNames"],
  });

export const ApiMetaComponentSchema = z.object({
  name: z.string().min(1),
  properties: z.array(ApiMetaPropertySchema).default([]),
  states: z.array(z.string().min(1)).default([]),
});

export const ApiMetaImportRequestSchema = z.object({
  // Платформа принимается из словаря БД целиком (она же задаёт платформу компонентов): backend не ограничен теми платформами,
  // меты которых CLI уже умеет читать.
  platform: z.enum(schema.componentPlatformEnum.enumValues),
  // Справочное имя файла меты (не путь): в журнале нужно знать, из какого файла залит слой.
  meta: z.object({ source: z.string().default("") }).default({ source: "" }),
  dryRun: z.boolean().default(true),
  components: z.array(ApiMetaComponentSchema).min(1),
});

export type ApiMetaProperty = z.infer<typeof ApiMetaPropertySchema>;

/**
 * Что манифест сообщает об устаревании алиаса.
 *
 * - `unknown` — имя пришло строкой: сведений нет, прежний статус не трогаем;
 * - `current` — имя пришло объектом без `deprecated`: алиас актуален, пометку надо снять;
 * - `deprecated` — алиас устарел, `message` может быть пустым.
 */
export type AliasDeprecation =
  | { kind: "unknown" }
  | { kind: "current" }
  | { kind: "deprecated"; message: string };

export interface ManifestAlias {
  name: string;
  deprecation: AliasDeprecation;
}

type PlatformNameInput = z.infer<typeof ApiMetaPlatformNameSchema>;

const aliasOfInput = (name: PlatformNameInput): ManifestAlias => {
  if (typeof name === "string") return { name, deprecation: { kind: "unknown" } };
  return {
    name: name.name,
    deprecation: name.deprecated
      ? { kind: "deprecated", message: name.deprecated.message }
      : { kind: "current" },
  };
};

/**
 * Платформенные имена свойства без повторов.
 *
 * `platformNames` главнее прежнего `platformName`: если пришли оба поля, второе игнорируется.
 * Повтор имени сводится в одно: устаревшим имя считается, если помечено хотя бы одно вхождение
 * (сообщение первого помеченного), а сведения «актуально» сильнее отсутствия сведений.
 */
export const aliasesOf = (property: ApiMetaProperty): ManifestAlias[] => {
  const source =
    property.platformNames?.map(aliasOfInput) ??
    (property.platformName ? [aliasOfInput(property.platformName)] : []);
  return mergeAliases(source);
};

export const mergeAliases = (aliases: ManifestAlias[]): ManifestAlias[] => {
  const merged = new Map<string, ManifestAlias>();
  for (const alias of aliases) {
    const known = merged.get(alias.name);
    if (!known) {
      merged.set(alias.name, alias);
    } else if (known.deprecation.kind === "deprecated") {
      continue;
    } else if (alias.deprecation.kind === "deprecated") {
      merged.set(alias.name, alias);
    } else if (known.deprecation.kind === "unknown" && alias.deprecation.kind === "current") {
      merged.set(alias.name, alias);
    }
  }
  return [...merged.values()];
};

/** Имена без сведений об устаревании. */
export const platformNamesOf = (property: ApiMetaProperty): string[] =>
  aliasesOf(property).map((alias) => alias.name);
export type ApiMetaComponent = z.infer<typeof ApiMetaComponentSchema>;
export type ApiMetaImportRequest = z.infer<typeof ApiMetaImportRequestSchema>;
