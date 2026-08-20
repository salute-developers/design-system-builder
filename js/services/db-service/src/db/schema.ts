import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const propertyTypeEnum = pgEnum("property_type", [
  "color",
  "typography",
  "shape",
  "shadow",
  "dimension",
  "float",
  "component_style",
  "value",
  "icon",
  "boolean",
  "gradient",
  "blur",
  // Тип из uikit-api-meta.json: счётчики и длительности (PaginationDots.edgeCount,
  // Wheel.visibleItemsCount, RectSkeleton.duration). В конфигурациях оформления те же
  // свойства записаны как value или float — глобальный слой берёт тип из кода.
  "integer",
]);

export const tokenTypeEnum = pgEnum("token_type", [
  "color",
  "gradient",
  "typography",
  "fontFamily",
  "spacing",
  "shape",
  "shadow",
]);

export const platformEnum = pgEnum("platform", ["web", "android", "ios"]);

export const propertyPlatformEnum = pgEnum("property_platform", [
  "xml",
  "compose",
  "ios",
  "web",
]);

export const modeEnum = pgEnum("mode", ["light", "dark"]);

export const publicationStatusEnum = pgEnum("publication_status", [
  "publishing",
  "published",
  "failed",
]);

export const operationEnum = pgEnum("operation", [
  "created",
  "updated",
  "deleted",
  "moved",
]);

export const relationTypeEnum = pgEnum("relation_type", ["reuse", "compose"]);

export const paletteTypeEnum = pgEnum("palette_type", [
  "general",
  "additional",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const designSystems = pgTable(
  "design_systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    projectName: text("project_name").notNull(),
    projectId: text("project_id"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("design_systems_name_unique").on(t.name),
  ],
);

export const designSystemVersions = pgTable(
  "design_system_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    // userId: uuid("user_id").references(() => users.id), // TODO Забирать из контекста аутентификации
    version: text("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changelog: text("changelog"),
    publicationStatus: publicationStatusEnum("publication_status"),
    publishedAt: timestamp("published_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("dsv_design_system_id_version_unique").on(
      t.designSystemId,
      t.version,
    ),
  ],
);

export const components = pgTable(
  "components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("components_name_unique").on(t.name),
  ],
);

export const designSystemComponents = pgTable(
  "design_system_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "dsc_design_system_id_component_id_unique",
    ).on(t.designSystemId, t.componentId),
  ],
);

export const variations = pgTable(
  "variations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("variations_component_id_name_unique").on(t.componentId, t.name),
  ],
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id").references(() => components.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: propertyTypeEnum("type").notNull(),
    defaultValue: text("default_value"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("properties_component_id_name_unique").on(t.componentId, t.name),
  ],
);

// Словарь состояний: и взаимодействия, и объявленные кодом компонента.
//
// `component_id IS NULL` — состояние взаимодействия. Оно принадлежит модели ввода, а не
// конкретному компоненту, и потому одинаково для всех: `pressed`, `hovered`, `focused`,
// `selected`, `activated`, `readonly`, `disabled`. Семь таких засеиваются миграцией
// детерминированными идентификаторами, чтобы код мог ссылаться на них без справочника.
//
// `component_id NOT NULL` — состояние, объявленное кодом компонента: в `uikit-api-meta.json`
// у него есть поле `stateEnum` с перечислением. `CheckBoxStates` даёт `checked` и
// `indeterminate`, `CollapsingNavigationBarStates` — `collapsed` и `expanded`.
//
// Прежде это были две разные сущности — значения enum `state` и таблица `component_states`.
// Словарь один, потому что набор состояний смешивает оба вида: `["checked", "focused"]` —
// это «отмечен И в фокусе», и разделять такой набор по двум справочникам нечем.
export const states = pgTable(
  "states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id").references(() => components.id, { onDelete: "cascade" }),
    // Имя в той форме, в какой оно встречается в конфигурациях оформления: `dragging-over`,
    // а не `DraggingOver`. В api-meta для этого есть поле `configName`.
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("states_component_id_name_unique").on(t.componentId, t.name),
    // Имя состояния взаимодействия уникально глобально. Частичный индекс нужен потому, что
    // NULL-ы в btree различны: без него индекс выше не помешал бы завести два `hovered`.
    uniqueIndex("states_name_unique_global")
      .on(t.name)
      .where(sql`${t.componentId} is null`),
  ],
);

// Набор состояний, при котором действует значение свойства.
//
// Набор — это конъюнкция (`pressed` И `checked`), и колонкой она не выражается. Прежде набор
// хранился дважды: связями в `property_value_states` и денормализованным ключом `states_key`
// на строке значения. Два представления одного факта разошлись на 19 строках.
//
// Здесь представление одно: массив **и есть** набор. Уникальность массива в PostgreSQL
// позиционная (`{A,B}` и `{B,A}` — разные), поэтому канонизация обязательна и обеспечивается
// триггером `state_sets_canonicalize`, а не индексом. Внешние ключи внутрь массива невыразимы,
// поэтому целостность элементов держат триггеры — см. `drizzle/0004_component_import.sql`.
//
// Пустой набор — строка-сентинел с `state_ids = '{}'`, а не NULL: NULL-ы в btree различны, и
// уникальность значений перестала бы работать именно для базовых значений, то есть для
// большинства.
export const stateSets = pgTable(
  "state_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stateIds: uuid("state_ids").array().notNull(),
    // Компонент, которому принадлежат компонентные состояния набора. NULL, если набор состоит
    // из одних состояний взаимодействия: у такого набора владельца нет, и он разделяется всеми
    // компонентами. Значение выводится из состава триггером, а не приходит от клиента.
    ownerComponentId: uuid("owner_component_id").references(() => components.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("state_sets_state_ids_unique").on(t.stateIds),
    // Нужен триггеру удаления: `state_ids @> ARRAY[...]`.
    index("state_sets_state_ids_gin").using("gin", t.stateIds),
  ],
);

export const propertyPlatformParams = pgTable(
  "property_platform_params",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    platform: propertyPlatformEnum("platform").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("ppp_property_id_platform_name_unique").on(t.propertyId, t.platform, t.name),
  ],
);

export const propertyVariations = pgTable(
  "property_variations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    variationId: uuid("variation_id")
      .notNull()
      .references(() => variations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "pv_property_id_variation_id_unique",
    ).on(t.propertyId, t.variationId),
  ],
);

export const appearances = pgTable(
  "appearances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    name: text("name").default("default"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "appearances_design_system_id_component_id_name_unique",
    ).on(t.designSystemId, t.componentId, t.name),
  ],
);

export const styles = pgTable(
  "styles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    variationId: uuid("variation_id")
      .notNull()
      .references(() => variations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("styles_ds_id_variation_id_name_unique").on(t.designSystemId, t.variationId, t.name),
    uniqueIndex("styles_variation_id_ds_id_is_default_unique")
      .on(t.variationId, t.designSystemId)
      .where(sql`is_default = true`),
  ],
);

export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id").references(() => designSystems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: tokenTypeEnum("type"),
    displayName: text("display_name"),
    description: text("description"),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("tokens_design_system_id_name_unique").on(
      t.designSystemId,
      t.name,
    ),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    name: text("name"),
    description: text("description"),
    colorConfig: jsonb("color_config")
      .notNull()
      .$type<{
        grayTone?: string;
        accentColor?: string;
        light?: { strokeSaturation: number; fillSaturation: number };
        dark?: { strokeSaturation: number; fillSaturation: number };
      }>()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("tenants_design_system_id_name_unique").on(
      t.designSystemId,
      t.name,
    ),
  ],
);

// paletteId и value могут сосуществовать: paletteId задаёт цвет из палитры,
// а value — дополнительные параметры (напр. прозрачность).
export const tokenValues = pgTable(
  "token_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenId: uuid("token_id").references(() => tokens.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    paletteId: uuid("palette_id").references(() => palette.id, { onDelete: "set null" }),
    platform: platformEnum("platform"),
    mode: modeEnum("mode"),
    value: jsonb("value").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("tv_token_tenant_platform_no_mode_unique")
      .on(t.tokenId, t.tenantId, t.platform)
      .where(sql`mode IS NULL`),
    uniqueIndex("tv_token_tenant_platform_mode_unique")
      .on(t.tokenId, t.tenantId, t.platform, t.mode)
      .where(sql`mode IS NOT NULL`),
  ],
);

export const variationPropertyValues = pgTable(
  "variation_property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    styleId: uuid("style_id")
      .notNull()
      .references(() => styles.id, { onDelete: "cascade" }),
    appearanceId: uuid("appearance_id")
      .notNull()
      .references(() => appearances.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id").references(() => tokens.id, { onDelete: "set null" }),
    value: text("value"),
    stateSetId: uuid("state_set_id")
      .notNull()
      .references(() => stateSets.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("vpv_style_property_appearance_states_unique").on(
      t.styleId,
      t.propertyId,
      t.appearanceId,
      t.stateSetId,
    ),
  ],
);

export const invariantPropertyValues = pgTable(
  "invariant_property_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    appearanceId: uuid("appearance_id")
      .notNull()
      .references(() => appearances.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id").references(() => tokens.id, { onDelete: "set null" }),
    value: text("value"),
    stateSetId: uuid("state_set_id")
      .notNull()
      .references(() => stateSets.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("ipv_ds_comp_prop_app_states_unique").on(
      t.designSystemId,
      t.componentId,
      t.propertyId,
      t.appearanceId,
      t.stateSetId,
    ),
  ],
);

export const variationPlatformParamAdjustments = pgTable(
  "variation_platform_param_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vpvId: uuid("vpv_id")
      .notNull()
      .references(() => variationPropertyValues.id, { onDelete: "cascade" }),
    platformParamId: uuid("platform_param_id")
      .notNull()
      .references(() => propertyPlatformParams.id, { onDelete: "cascade" }),
    value: text("value"),
    template: text("template"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("vppa_vpv_platform_param_unique").on(
      t.vpvId,
      t.platformParamId,
    ),
  ],
);

export const invariantPlatformParamAdjustments = pgTable(
  "invariant_platform_param_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipvId: uuid("ipv_id")
      .notNull()
      .references(() => invariantPropertyValues.id, { onDelete: "cascade" }),
    platformParamId: uuid("platform_param_id")
      .notNull()
      .references(() => propertyPlatformParams.id, { onDelete: "cascade" }),
    value: text("value"),
    template: text("template"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("ippa_ipv_platform_param_unique").on(
      t.ipvId,
      t.platformParamId,
    ),
  ],
);

export const documentationPages = pgTable(
  "documentation_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "documentation_pages_design_system_id_unique",
    ).on(t.designSystemId),
  ],
);

export const componentDeps = pgTable(
  "component_deps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    type: relationTypeEnum("type").notNull(),
    order: integer("order"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("cd_parent_id_child_id_unique").on(
      t.parentId,
      t.childId,
    ),
  ],
);

// Конфигурация reuse-связей компонентов в контексте дизайн-системы
export const componentReuseConfigs = pgTable(
  "component_reuse_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentDepId: uuid("component_dep_id")
      .notNull()
      .references(() => componentDeps.id, { onDelete: "cascade" }),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    appearanceId: uuid("appearance_id")
      .notNull()
      .references(() => appearances.id, { onDelete: "cascade" }),
    variationId: uuid("variation_id")
      .notNull()
      .references(() => variations.id, { onDelete: "cascade" }),
    styleId: uuid("style_id")
      .notNull()
      .references(() => styles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("crc_dep_ds_appearance_variation_unique").on(
      t.componentDepId,
      t.designSystemId,
      t.appearanceId,
      t.variationId,
    ),
  ],
);

export const styleCombinations = pgTable(
  "style_combinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    appearanceId: uuid("appearance_id")
      .notNull()
      .references(() => appearances.id, { onDelete: "cascade" }),
    // Канонический ключ сочетания: отсортированные id стилей-участников через запятую.
    // Состав сочетания хранится в style_combination_members, поэтому уникальность по нему
    // невыразима индексом на этой таблице. Через кросс-осевые значения проходит более
    // половины импорта, и без ключа повторная загрузка дублировала бы их.
    combinationKey: text("combination_key").notNull().default(""),
    value: text("value").notNull(),
    // Строка сочетания несёт одно значение и один набор состояний. Прежде она несла базовое
    // значение плюс массив переопределений в jsonb (`[{"state":["activated"],"value":32}]`) —
    // четвёртое представление состояний, вне словаря и вне ссылочной целостности. Теперь
    // каждое значение — отдельная строка со своим набором.
    stateSetId: uuid("state_set_id")
      .notNull()
      .references(() => stateSets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("sc_property_appearance_combination_unique").on(
      t.propertyId,
      t.appearanceId,
      t.combinationKey,
      t.stateSetId,
    ),
  ],
);

export const styleCombinationMembers = pgTable(
  "style_combination_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    combinationId: uuid("combination_id")
      .notNull()
      .references(() => styleCombinations.id, { onDelete: "cascade" }),
    styleId: uuid("style_id")
      .notNull()
      .references(() => styles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "scm_combination_id_style_id_unique",
    ).on(t.combinationId, t.styleId),
  ],
);

// Реляционная связь ссылок component_style с оформлением дочернего компонента.
//
// Значение свойства типа `component_style` имеет вид `<styleName>[.<axis>...]`, например
// `basic-button.size-40.mode-accent-grey`. До этой таблицы связь существовала только строкой:
// целостность не проверялась, а разбор ссылки был задачей читающей стороны.
//
// Родительский контекст здесь не хранится: строка значения, на которую ссылается запись,
// уже знает, при каком сочетании осей родителя ссылка действует. Хранить его второй раз
// значило бы завести второй источник истины.
export const componentStyleReferences = pgTable(
  "component_style_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),

    // Ровно одна из трёх ссылок заполнена — в зависимости от того, от скольких осей родителя
    // зависит значение: ни от одной, от одной, либо от нескольких.
    invariantPropertyValueId: uuid("invariant_property_value_id").references(
      () => invariantPropertyValues.id,
      { onDelete: "cascade" },
    ),
    variationPropertyValueId: uuid("variation_property_value_id").references(
      () => variationPropertyValues.id,
      { onDelete: "cascade" },
    ),
    styleCombinationId: uuid("style_combination_id").references(() => styleCombinations.id, {
      onDelete: "cascade",
    }),

    // Оформление дочернего компонента, на которое указывает первый сегмент ссылки.
    targetAppearanceId: uuid("target_appearance_id")
      .notNull()
      .references(() => appearances.id, { onDelete: "cascade" }),

    // Исходная строка ссылки. Сохраняется, потому что порядок осей в ней не выводится
    // из набора стилей, а он нужен для обратного преобразования в native-формат.
    reference: text("reference").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    check(
      "csr_exactly_one_source",
      sql`(
        (${t.invariantPropertyValueId} is not null)::int +
        (${t.variationPropertyValueId} is not null)::int +
        (${t.styleCombinationId} is not null)::int
      ) = 1`,
    ),
    uniqueIndex("csr_invariant_value_unique")
      .on(t.invariantPropertyValueId)
      .where(sql`invariant_property_value_id is not null`),
    uniqueIndex("csr_variation_value_unique")
      .on(t.variationPropertyValueId)
      .where(sql`variation_property_value_id is not null`),
    uniqueIndex("csr_style_combination_unique")
      .on(t.styleCombinationId)
      .where(sql`style_combination_id is not null`),
    index("csr_target_appearance_idx").on(t.targetAppearanceId),
  ],
);

// Стили дочернего компонента, названные хвостом ссылки: от нуля до трёх на запись.
export const componentStyleReferenceStyles = pgTable(
  "component_style_reference_styles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceId: uuid("reference_id")
      .notNull()
      .references(() => componentStyleReferences.id, { onDelete: "cascade" }),
    styleId: uuid("style_id")
      .notNull()
      .references(() => styles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("csrs_reference_id_style_id_unique").on(t.referenceId, t.styleId),
  ],
);

// Таблица изменений — аудит-лог
export const designSystemChanges = pgTable(
  "design_system_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    designSystemId: uuid("design_system_id")
      .notNull()
      .references(() => designSystems.id, { onDelete: "cascade" }),
    // userId: uuid("user_id").references(() => users.id), // TODO Забирать из контекста аутентификации
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    operation: operationEnum("operation").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("dsc_design_system_id_created_at_idx").on(
      t.designSystemId,
      t.createdAt,
    ),
  ],
);

// Сохранённые пользовательские запросы (сгенерированные через NL Query)
export const savedQueries = pgTable("saved_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  sql: text("sql").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Цветовая палитра (general / additional)
export const palette = pgTable(
  "palette",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: paletteTypeEnum("type").notNull(),
    shade: text("shade").notNull(),
    saturation: integer("saturation").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex(
      "palette_type_shade_saturation_unique",
    ).on(t.type, t.shade, t.saturation),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const designSystemsRelations = relations(designSystems, ({ many }) => ({
  versions: many(designSystemVersions),
  designSystemComponents: many(designSystemComponents),
  styles: many(styles),
  tokens: many(tokens),
  tenants: many(tenants),
  appearances: many(appearances),
  invariantPropertyValues: many(invariantPropertyValues),
  documentationPages: many(documentationPages),
  designSystemChanges: many(designSystemChanges),
  componentReuseConfigs: many(componentReuseConfigs),
}));

export const designSystemVersionsRelations = relations(
  designSystemVersions,
  ({ one }) => ({
    designSystem: one(designSystems, {
      fields: [designSystemVersions.designSystemId],
      references: [designSystems.id],
    }),
    // TODO: Забирать из контекста аутентификации
    // user: one(users, {
    //   fields: [designSystemVersions.userId],
    //   references: [users.id],
    // }),
  }),
);

export const componentsRelations = relations(components, ({ many }) => ({
  designSystemComponents: many(designSystemComponents),
  variations: many(variations),
  properties: many(properties),
  appearances: many(appearances),
  parentDeps: many(componentDeps, { relationName: "parent" }),
  childDeps: many(componentDeps, { relationName: "child" }),
  invariantPropertyValues: many(invariantPropertyValues),
  states: many(states),
}));

export const statesRelations = relations(states, ({ one }) => ({
  component: one(components, {
    fields: [states.componentId],
    references: [components.id],
  }),
}));

export const stateSetsRelations = relations(stateSets, ({ one, many }) => ({
  ownerComponent: one(components, {
    fields: [stateSets.ownerComponentId],
    references: [components.id],
  }),
  variationPropertyValues: many(variationPropertyValues),
  invariantPropertyValues: many(invariantPropertyValues),
  styleCombinations: many(styleCombinations),
}));

export const designSystemComponentsRelations = relations(
  designSystemComponents,
  ({ one }) => ({
    designSystem: one(designSystems, {
      fields: [designSystemComponents.designSystemId],
      references: [designSystems.id],
    }),
    component: one(components, {
      fields: [designSystemComponents.componentId],
      references: [components.id],
    }),
  }),
);

export const variationsRelations = relations(variations, ({ one, many }) => ({
  component: one(components, {
    fields: [variations.componentId],
    references: [components.id],
  }),
  propertyVariations: many(propertyVariations),
  styles: many(styles),
  componentReuseConfigs: many(componentReuseConfigs),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  component: one(components, {
    fields: [properties.componentId],
    references: [components.id],
  }),
  propertyPlatformParams: many(propertyPlatformParams),
  propertyVariations: many(propertyVariations),
  variationPropertyValues: many(variationPropertyValues),
  invariantPropertyValues: many(invariantPropertyValues),
  styleCombinations: many(styleCombinations),
}));

export const propertyPlatformParamsRelations = relations(
  propertyPlatformParams,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [propertyPlatformParams.propertyId],
      references: [properties.id],
    }),
    variationAdjustments: many(variationPlatformParamAdjustments),
    invariantAdjustments: many(invariantPlatformParamAdjustments),
  }),
);

export const propertyVariationsRelations = relations(
  propertyVariations,
  ({ one }) => ({
    property: one(properties, {
      fields: [propertyVariations.propertyId],
      references: [properties.id],
    }),
    variation: one(variations, {
      fields: [propertyVariations.variationId],
      references: [variations.id],
    }),
  }),
);

export const appearancesRelations = relations(appearances, ({ one, many }) => ({
  designSystem: one(designSystems, {
    fields: [appearances.designSystemId],
    references: [designSystems.id],
  }),
  component: one(components, {
    fields: [appearances.componentId],
    references: [components.id],
  }),
  variationPropertyValues: many(variationPropertyValues),
  invariantPropertyValues: many(invariantPropertyValues),
  styleCombinations: many(styleCombinations),
  componentReuseConfigs: many(componentReuseConfigs),
}));

export const stylesRelations = relations(styles, ({ one, many }) => ({
  designSystem: one(designSystems, {
    fields: [styles.designSystemId],
    references: [designSystems.id],
  }),
  variation: one(variations, {
    fields: [styles.variationId],
    references: [variations.id],
  }),
  variationPropertyValues: many(variationPropertyValues),
  styleCombinationMembers: many(styleCombinationMembers),
  componentReuseConfigs: many(componentReuseConfigs),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  designSystem: one(designSystems, {
    fields: [tokens.designSystemId],
    references: [designSystems.id],
  }),
  tokenValues: many(tokenValues),
  variationPropertyValues: many(variationPropertyValues),
  invariantPropertyValues: many(invariantPropertyValues),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  designSystem: one(designSystems, {
    fields: [tenants.designSystemId],
    references: [designSystems.id],
  }),
  tokenValues: many(tokenValues),
}));

export const tokenValuesRelations = relations(tokenValues, ({ one }) => ({
  token: one(tokens, {
    fields: [tokenValues.tokenId],
    references: [tokens.id],
  }),
  tenant: one(tenants, {
    fields: [tokenValues.tenantId],
    references: [tenants.id],
  }),
  palette: one(palette, {
    fields: [tokenValues.paletteId],
    references: [palette.id],
  }),
}));

export const variationPropertyValuesRelations = relations(
  variationPropertyValues,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [variationPropertyValues.propertyId],
      references: [properties.id],
    }),
    style: one(styles, {
      fields: [variationPropertyValues.styleId],
      references: [styles.id],
    }),
    appearance: one(appearances, {
      fields: [variationPropertyValues.appearanceId],
      references: [appearances.id],
    }),
    token: one(tokens, {
      fields: [variationPropertyValues.tokenId],
      references: [tokens.id],
    }),
    stateSet: one(stateSets, {
      fields: [variationPropertyValues.stateSetId],
      references: [stateSets.id],
    }),
    platformParamAdjustments: many(variationPlatformParamAdjustments),
  }),
);

export const invariantPropertyValuesRelations = relations(
  invariantPropertyValues,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [invariantPropertyValues.propertyId],
      references: [properties.id],
    }),
    designSystem: one(designSystems, {
      fields: [invariantPropertyValues.designSystemId],
      references: [designSystems.id],
    }),
    component: one(components, {
      fields: [invariantPropertyValues.componentId],
      references: [components.id],
    }),
    appearance: one(appearances, {
      fields: [invariantPropertyValues.appearanceId],
      references: [appearances.id],
    }),
    token: one(tokens, {
      fields: [invariantPropertyValues.tokenId],
      references: [tokens.id],
    }),
    stateSet: one(stateSets, {
      fields: [invariantPropertyValues.stateSetId],
      references: [stateSets.id],
    }),
    platformParamAdjustments: many(invariantPlatformParamAdjustments),
  }),
);

export const variationPlatformParamAdjustmentsRelations = relations(
  variationPlatformParamAdjustments,
  ({ one }) => ({
    vpv: one(variationPropertyValues, {
      fields: [variationPlatformParamAdjustments.vpvId],
      references: [variationPropertyValues.id],
    }),
    platformParam: one(propertyPlatformParams, {
      fields: [variationPlatformParamAdjustments.platformParamId],
      references: [propertyPlatformParams.id],
    }),
  }),
);

export const invariantPlatformParamAdjustmentsRelations = relations(
  invariantPlatformParamAdjustments,
  ({ one }) => ({
    ipv: one(invariantPropertyValues, {
      fields: [invariantPlatformParamAdjustments.ipvId],
      references: [invariantPropertyValues.id],
    }),
    platformParam: one(propertyPlatformParams, {
      fields: [invariantPlatformParamAdjustments.platformParamId],
      references: [propertyPlatformParams.id],
    }),
  }),
);

export const documentationPagesRelations = relations(
  documentationPages,
  ({ one }) => ({
    designSystem: one(designSystems, {
      fields: [documentationPages.designSystemId],
      references: [designSystems.id],
    }),
  }),
);

export const componentDepsRelations = relations(
  componentDeps,
  ({ one, many }) => ({
    parent: one(components, {
      fields: [componentDeps.parentId],
      references: [components.id],
      relationName: "parent",
    }),
    child: one(components, {
      fields: [componentDeps.childId],
      references: [components.id],
      relationName: "child",
    }),
    reuseConfigs: many(componentReuseConfigs),
  }),
);

export const componentReuseConfigsRelations = relations(
  componentReuseConfigs,
  ({ one }) => ({
    componentDep: one(componentDeps, {
      fields: [componentReuseConfigs.componentDepId],
      references: [componentDeps.id],
    }),
    designSystem: one(designSystems, {
      fields: [componentReuseConfigs.designSystemId],
      references: [designSystems.id],
    }),
    appearance: one(appearances, {
      fields: [componentReuseConfigs.appearanceId],
      references: [appearances.id],
    }),
    variation: one(variations, {
      fields: [componentReuseConfigs.variationId],
      references: [variations.id],
    }),
    style: one(styles, {
      fields: [componentReuseConfigs.styleId],
      references: [styles.id],
    }),
  }),
);

export const styleCombinationsRelations = relations(
  styleCombinations,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [styleCombinations.propertyId],
      references: [properties.id],
    }),
    appearance: one(appearances, {
      fields: [styleCombinations.appearanceId],
      references: [appearances.id],
    }),
    stateSet: one(stateSets, {
      fields: [styleCombinations.stateSetId],
      references: [stateSets.id],
    }),
    members: many(styleCombinationMembers),
  }),
);

export const styleCombinationMembersRelations = relations(
  styleCombinationMembers,
  ({ one }) => ({
    combination: one(styleCombinations, {
      fields: [styleCombinationMembers.combinationId],
      references: [styleCombinations.id],
    }),
    style: one(styles, {
      fields: [styleCombinationMembers.styleId],
      references: [styles.id],
    }),
  }),
);

export const designSystemChangesRelations = relations(
  designSystemChanges,
  ({ one }) => ({
    designSystem: one(designSystems, {
      fields: [designSystemChanges.designSystemId],
      references: [designSystems.id],
    }),
    // TODO: Забирать из контекста аутентификации
    // user: one(users, {
    //   fields: [designSystemChanges.userId],
    //   references: [users.id],
    // }),
  }),
);
