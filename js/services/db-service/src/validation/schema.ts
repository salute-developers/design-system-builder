import "../zod-extend";
import { z } from "zod";
import { propertyTypeEnum } from "../db/schema";

const uuidSchema = z.string().uuid("Must be a valid UUID");

// Enum schemas
// Значения берутся из схемы БД, а не дублируются списком: миграция 0004 расширила оба enum,
// и ручная копия молча отвергала бы допустимые типы.
export const PropertyTypeSchema = z.enum(propertyTypeEnum.enumValues);
export const TokenTypeSchema = z.enum([
  "color",
  "gradient",
  "typography",
  "fontFamily",
  "spacing",
  "shape",
  "shadow",
]);
export const PlatformSchema = z.enum(["web", "android", "ios"]);
export const ModeSchema = z.enum(["light", "dark"]);
export const PublicationStatusSchema = z.enum([
  "publishing",
  "published",
  "failed",
]);
export const OperationSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "moved",
]);
export const RelationTypeSchema = z.enum(["reuse", "compose"]);
// Словарь состояний живёт в таблице `states`, а не в типе БД, поэтому типизированный union
// из него больше не выводится: множество открыто и растёт с каждым новым компонентом.
// Состояние опознаётся идентификатором, а валидация имени — делом справочника.
export const StateIdSchema = uuidSchema;
export const PaletteTypeSchema = z.enum(["general", "additional"]);

// Common param schemas
export const UuidParamSchema = z.object({ id: uuidSchema });
export const PaginationQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  })
  .optional();

// Design Systems
export const CreateDesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  projectName: z.string().trim().min(1).max(255),
  projectId: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});
export const UpdateDesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  projectId: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Design System Versions
export const CreateDesignSystemVersionSchema = z.object({
  designSystemId: uuidSchema,
  version: z.string().trim().min(1).max(50),
  snapshot: z.any(),
  changelog: z.string().trim().optional(),
  publicationStatus: PublicationStatusSchema.optional(),
});
export const UpdateDesignSystemVersionSchema = z.object({
  changelog: z.string().trim().optional(),
  publicationStatus: PublicationStatusSchema.optional(),
});

// Components
export const CreateComponentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});
export const UpdateComponentSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Design System Components
export const CreateDesignSystemComponentSchema = z.object({
  designSystemId: uuidSchema,
  componentId: uuidSchema,
});

// Variations
export const CreateVariationSchema = z.object({
  componentId: uuidSchema,
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});
export const UpdateVariationSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Properties
export const CreatePropertySchema = z.object({
  componentId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(255),
  type: PropertyTypeSchema,
  defaultValue: z.string().trim().optional(),
  description: z.string().trim().max(1000).optional(),
});
export const UpdatePropertySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  type: PropertyTypeSchema.optional(),
  defaultValue: z.string().trim().optional(),
  description: z.string().trim().max(1000).optional(),
});

// Property Platform Params
export const PropertyPlatformSchema = z.enum(["xml", "compose", "ios", "web"]);
export const CreatePropertyPlatformParamSchema = z.object({
  propertyId: uuidSchema,
  platform: PropertyPlatformSchema,
  name: z.string().trim().min(1).max(255),
});
export const UpdatePropertyPlatformParamSchema = z.object({
  platform: PropertyPlatformSchema.optional(),
  name: z.string().trim().min(1).max(255).optional(),
});

// Variation Platform Param Adjustments
export const CreateVariationPlatformParamAdjustmentSchema = z.object({
  vpvId: uuidSchema,
  platformParamId: uuidSchema,
  value: z.string().trim().optional(),
  template: z.string().trim().optional(),
});
export const UpdateVariationPlatformParamAdjustmentSchema = z.object({
  value: z.string().trim().optional(),
  template: z.string().trim().optional(),
});

// Invariant Platform Param Adjustments
export const CreateInvariantPlatformParamAdjustmentSchema = z.object({
  ipvId: uuidSchema,
  platformParamId: uuidSchema,
  value: z.string().trim().optional(),
  template: z.string().trim().optional(),
});
export const UpdateInvariantPlatformParamAdjustmentSchema = z.object({
  value: z.string().trim().optional(),
  template: z.string().trim().optional(),
});

// Property Variations
export const CreatePropertyVariationSchema = z.object({
  propertyId: uuidSchema,
  variationId: uuidSchema,
});

// Appearances
export const CreateAppearanceSchema = z.object({
  designSystemId: uuidSchema,
  componentId: uuidSchema,
  name: z.string().trim().max(255).optional().default("default"),
});
export const UpdateAppearanceSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

// Styles
export const CreateStyleSchema = z.object({
  designSystemId: uuidSchema,
  variationId: uuidSchema,
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});
export const UpdateStyleSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Appearance Variations (объявление оси вариаций на уровне appearance: состав, порядок
// и дефолт принадлежат паре (компонент, стиль), а не дизайн-системе)
export const CreateAppearanceVariationSchema = z.object({
  appearanceId: uuidSchema,
  variationId: uuidSchema,
  position: z.number().int(),
  defaultStyleId: uuidSchema.nullish(),
});
export const UpdateAppearanceVariationSchema = z.object({
  position: z.number().int().optional(),
  defaultStyleId: uuidSchema.nullish(),
});

// Appearance Variation Values (объявленные значения оси, а не использованные)
export const CreateAppearanceVariationValueSchema = z.object({
  appearanceVariationId: uuidSchema,
  styleId: uuidSchema,
  position: z.number().int(),
});
export const UpdateAppearanceVariationValueSchema = z.object({
  position: z.number().int().optional(),
});

// Tokens
export const CreateTokenSchema = z.object({
  designSystemId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(255),
  type: TokenTypeSchema.optional(),
  displayName: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  enabled: z.boolean().optional().default(true),
});
export const UpdateTokenSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  type: TokenTypeSchema.optional(),
  displayName: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  enabled: z.boolean().optional(),
});

// Tenants
const ColorConfigSchema = z
  .object({
    grayTone: z.string().optional(),
    accentColor: z.string().optional(),
    light: z
      .object({ strokeSaturation: z.number(), fillSaturation: z.number() })
      .optional(),
    dark: z
      .object({ strokeSaturation: z.number(), fillSaturation: z.number() })
      .optional(),
  })
  .optional();

export const CreateTenantSchema = z.object({
  designSystemId: uuidSchema,
  name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  colorConfig: ColorConfigSchema,
});
export const UpdateTenantSchema = z.object({
  name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  colorConfig: ColorConfigSchema,
});

// Token Values
export const CreateTokenValueSchema = z.object({
  tokenId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  paletteId: uuidSchema.optional(),
  platform: PlatformSchema.optional(),
  mode: ModeSchema.optional(),
  value: z.any().optional(),
});
export const UpdateTokenValueSchema = z.object({
  paletteId: uuidSchema.optional(),
  platform: PlatformSchema.optional(),
  mode: ModeSchema.optional(),
  value: z.any().optional(),
});

// Variation Property Values
export const CreateVariationPropertyValueSchema = z.object({
  propertyId: uuidSchema,
  styleId: uuidSchema,
  appearanceId: uuidSchema,
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  // Прозрачность и поправка формы хранятся текстом в исходной записи: значение
  // возвращается в конфигурацию тем же текстом, поэтому нормализация недопустима.
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  // Набор состояний, при котором действует значение. Значение может действовать при
  // нескольких состояниях сразу, и колонкой это не выразить, поэтому набор — отдельная
  // сущность. Идентификатор берётся из POST /ds/state-sets/resolve; пустой набор —
  // строка-сентинел, а не отсутствие ссылки.
  stateSetId: uuidSchema,
});
export const UpdateVariationPropertyValueSchema = z.object({
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  stateSetId: uuidSchema.optional(),
});

// Invariant Property Values
export const CreateInvariantPropertyValueSchema = z.object({
  propertyId: uuidSchema,
  designSystemId: uuidSchema,
  componentId: uuidSchema,
  appearanceId: uuidSchema,
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  // Прозрачность и поправка формы хранятся текстом в исходной записи: значение
  // возвращается в конфигурацию тем же текстом, поэтому нормализация недопустима.
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  stateSetId: uuidSchema,
});
export const UpdateInvariantPropertyValueSchema = z.object({
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  stateSetId: uuidSchema.optional(),
});

// Documentation Pages
export const CreateDocumentationPageSchema = z.object({
  designSystemId: uuidSchema,
  content: z.string().min(1),
});
export const UpdateDocumentationPageSchema = z.object({
  content: z.string().min(1).optional(),
});

// Component Deps
export const CreateComponentDepSchema = z.object({
  parentId: uuidSchema,
  childId: uuidSchema,
  type: RelationTypeSchema,
  order: z.number().int().optional(),
});
export const UpdateComponentDepSchema = z.object({
  type: RelationTypeSchema.optional(),
  order: z.number().int().optional(),
});

// Component Reuse Configs
export const CreateComponentReuseConfigSchema = z.object({
  componentDepId: uuidSchema,
  designSystemId: uuidSchema,
  appearanceId: uuidSchema,
  variationId: uuidSchema,
  styleId: uuidSchema,
});
export const UpdateComponentReuseConfigSchema = z.object({
  appearanceId: uuidSchema.optional(),
  variationId: uuidSchema.optional(),
  styleId: uuidSchema.optional(),
});

// Style Combinations
export const CreateStyleCombinationSchema = z.object({
  propertyId: uuidSchema,
  appearanceId: uuidSchema,
  combinationKey: z.string().trim().optional(),
  value: z.string().trim().min(1),
  tokenId: uuidSchema.optional(),
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  // Строка сочетания несёт одно значение и один набор: переопределения по состояниям —
  // отдельные строки, а не массив в jsonb.
  stateSetId: uuidSchema,
});
export const UpdateStyleCombinationSchema = z.object({
  value: z.string().trim().min(1).optional(),
  tokenId: uuidSchema.optional(),
  alpha: z.string().trim().optional(),
  adjustment: z.string().trim().optional(),
  stateSetId: uuidSchema.optional(),
});

// Style Combination Members
export const CreateStyleCombinationMemberSchema = z.object({
  combinationId: uuidSchema,
  styleId: uuidSchema,
});

// States (словарь состояний: взаимодействия при пустом componentId, иначе объявленные
// кодом компонента и залитые из uikit-api-meta.json)
export const CreateStateSchema = z.object({
  componentId: uuidSchema.nullish(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});

export const UpdateStateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// State Sets (набор состояний)
//
// Единственная точка конструирования набора. Канонизацию массива, проверку того, что все
// элементы существуют, и вычисление владельца делает триггер на таблице, поэтому здесь
// проверяется только форма запроса. Прямая запись в `state_sets` из клиентского кода
// запрещена: собранный на клиенте массив — это второе место, где набор считается своим
// способом.
export const ResolveStateSetSchema = z.object({
  stateIds: z.array(uuidSchema).max(32),
});

// Component Style References (реляционная ссылка на стиль другого компонента — пишется импортом)
export const CreateComponentStyleReferenceSchema = z.object({
  designSystemId: uuidSchema,
  targetAppearanceId: uuidSchema,
  reference: z.string().trim().min(1).max(255),
  variationPropertyValueId: uuidSchema.optional(),
  invariantPropertyValueId: uuidSchema.optional(),
  styleCombinationId: uuidSchema.optional(),
});

export const CreateComponentStyleReferenceStyleSchema = z.object({
  referenceId: uuidSchema,
  styleId: uuidSchema,
});

// Design System Changes (audit log - create only, typically internal)
export const CreateDesignSystemChangeSchema = z.object({
  designSystemId: uuidSchema,
  entityType: z.string().trim().min(1),
  entityId: uuidSchema,
  operation: OperationSchema,
  data: z.any().optional(),
});

// Saved Queries
export const CreateSavedQuerySchema = z.object({
  label: z.string().trim().min(1).max(500),
  sql: z.string().trim().min(1),
});
export const UpdateSavedQuerySchema = z.object({
  label: z.string().trim().min(1).max(500).optional(),
  sql: z.string().trim().min(1).optional(),
});

// Palette
export const CreatePaletteSchema = z.object({
  type: PaletteTypeSchema,
  shade: z.string().trim().min(1).max(100),
  saturation: z.number().int().min(0).max(100),
  value: z.string().trim().min(1),
});
export const UpdatePaletteSchema = z.object({
  value: z.string().trim().min(1).optional(),
});

// Exported types
export type UuidParam = z.infer<typeof UuidParamSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type CreateDesignSystemRequest = z.infer<
  typeof CreateDesignSystemSchema
>;
export type UpdateDesignSystemRequest = z.infer<
  typeof UpdateDesignSystemSchema
>;
export type CreateDesignSystemVersionRequest = z.infer<
  typeof CreateDesignSystemVersionSchema
>;
export type UpdateDesignSystemVersionRequest = z.infer<
  typeof UpdateDesignSystemVersionSchema
>;
export type CreateComponentRequest = z.infer<typeof CreateComponentSchema>;
export type UpdateComponentRequest = z.infer<typeof UpdateComponentSchema>;
export type CreateDesignSystemComponentRequest = z.infer<
  typeof CreateDesignSystemComponentSchema
>;
export type CreateVariationRequest = z.infer<typeof CreateVariationSchema>;
export type UpdateVariationRequest = z.infer<typeof UpdateVariationSchema>;
export type CreatePropertyRequest = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyRequest = z.infer<typeof UpdatePropertySchema>;
export type CreatePropertyPlatformParamRequest = z.infer<
  typeof CreatePropertyPlatformParamSchema
>;
export type UpdatePropertyPlatformParamRequest = z.infer<
  typeof UpdatePropertyPlatformParamSchema
>;
export type CreateVariationPlatformParamAdjustmentRequest = z.infer<
  typeof CreateVariationPlatformParamAdjustmentSchema
>;
export type UpdateVariationPlatformParamAdjustmentRequest = z.infer<
  typeof UpdateVariationPlatformParamAdjustmentSchema
>;
export type CreateInvariantPlatformParamAdjustmentRequest = z.infer<
  typeof CreateInvariantPlatformParamAdjustmentSchema
>;
export type UpdateInvariantPlatformParamAdjustmentRequest = z.infer<
  typeof UpdateInvariantPlatformParamAdjustmentSchema
>;
export type CreatePropertyVariationRequest = z.infer<
  typeof CreatePropertyVariationSchema
>;
export type CreateAppearanceRequest = z.infer<typeof CreateAppearanceSchema>;
export type UpdateAppearanceRequest = z.infer<typeof UpdateAppearanceSchema>;
export type CreateStyleRequest = z.infer<typeof CreateStyleSchema>;
export type UpdateStyleRequest = z.infer<typeof UpdateStyleSchema>;
export type CreateAppearanceVariationRequest = z.infer<typeof CreateAppearanceVariationSchema>;
export type UpdateAppearanceVariationRequest = z.infer<typeof UpdateAppearanceVariationSchema>;
export type CreateAppearanceVariationValueRequest = z.infer<typeof CreateAppearanceVariationValueSchema>;
export type UpdateAppearanceVariationValueRequest = z.infer<typeof UpdateAppearanceVariationValueSchema>;
export type CreateTokenRequest = z.infer<typeof CreateTokenSchema>;
export type UpdateTokenRequest = z.infer<typeof UpdateTokenSchema>;
export type CreateTenantRequest = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantRequest = z.infer<typeof UpdateTenantSchema>;
export type CreateTokenValueRequest = z.infer<typeof CreateTokenValueSchema>;
export type UpdateTokenValueRequest = z.infer<typeof UpdateTokenValueSchema>;
export type CreateVariationPropertyValueRequest = z.infer<
  typeof CreateVariationPropertyValueSchema
>;
export type UpdateVariationPropertyValueRequest = z.infer<
  typeof UpdateVariationPropertyValueSchema
>;
export type CreateInvariantPropertyValueRequest = z.infer<
  typeof CreateInvariantPropertyValueSchema
>;
export type UpdateInvariantPropertyValueRequest = z.infer<
  typeof UpdateInvariantPropertyValueSchema
>;
export type CreateDocumentationPageRequest = z.infer<
  typeof CreateDocumentationPageSchema
>;
export type UpdateDocumentationPageRequest = z.infer<
  typeof UpdateDocumentationPageSchema
>;
export type CreateComponentDepRequest = z.infer<
  typeof CreateComponentDepSchema
>;
export type UpdateComponentDepRequest = z.infer<
  typeof UpdateComponentDepSchema
>;
export type CreateComponentReuseConfigRequest = z.infer<
  typeof CreateComponentReuseConfigSchema
>;
export type UpdateComponentReuseConfigRequest = z.infer<
  typeof UpdateComponentReuseConfigSchema
>;
export type CreateStyleCombinationRequest = z.infer<
  typeof CreateStyleCombinationSchema
>;
export type UpdateStyleCombinationRequest = z.infer<
  typeof UpdateStyleCombinationSchema
>;
export type CreateStyleCombinationMemberRequest = z.infer<
  typeof CreateStyleCombinationMemberSchema
>;
export type CreateDesignSystemChangeRequest = z.infer<
  typeof CreateDesignSystemChangeSchema
>;
export type CreateSavedQueryRequest = z.infer<typeof CreateSavedQuerySchema>;
export type UpdateSavedQueryRequest = z.infer<typeof UpdateSavedQuerySchema>;
export type CreatePaletteRequest = z.infer<typeof CreatePaletteSchema>;
export type UpdatePaletteRequest = z.infer<typeof UpdatePaletteSchema>;
export type CreateStateRequest = z.infer<typeof CreateStateSchema>;
export type UpdateStateRequest = z.infer<typeof UpdateStateSchema>;
export type ResolveStateSetRequest = z.infer<typeof ResolveStateSetSchema>;
export type CreateComponentStyleReferenceRequest = z.infer<
  typeof CreateComponentStyleReferenceSchema
>;
export type CreateComponentStyleReferenceStyleRequest = z.infer<
  typeof CreateComponentStyleReferenceStyleSchema
>;
