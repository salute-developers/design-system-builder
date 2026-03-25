import "../zod-extend";
import { z } from "zod";

const uuidSchema = z.string().uuid("Must be a valid UUID");

// Enum schemas
export const PropertyTypeSchema = z.enum([
  "color",
  "typography",
  "shape",
  "shadow",
  "dimension",
  "float",
]);
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
export const StateSchema = z.enum([
  "pressed",
  "hovered",
  "focused",
  "selected",
  "readonly",
  "disabled",
]);
export const PaletteTypeSchema = z.enum(["general", "additional"]);

// Common param schemas
export const UuidParamSchema = z.object({ id: uuidSchema });
export const PaginationQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  })
  .optional();

// Users
export const CreateUserSchema = z.object({
  login: z.string().trim().min(1).max(255),
  token: z.string().trim().min(1),
});
export const UpdateUserSchema = z.object({
  login: z.string().trim().min(1).max(255).optional(),
  token: z.string().trim().min(1).optional(),
});

// Design Systems
export const CreateDesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  projectName: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});
export const UpdateDesignSystemSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
});

// Design System Versions
export const CreateDesignSystemVersionSchema = z.object({
  designSystemId: uuidSchema,
  userId: uuidSchema.optional(),
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
  isDefault: z.boolean().optional().default(false),
});
export const UpdateStyleSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  isDefault: z.boolean().optional(),
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
  state: StateSchema.optional(),
});
export const UpdateVariationPropertyValueSchema = z.object({
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  state: StateSchema.optional(),
});

// Invariant Property Values
export const CreateInvariantPropertyValueSchema = z.object({
  propertyId: uuidSchema,
  designSystemId: uuidSchema,
  componentId: uuidSchema,
  appearanceId: uuidSchema,
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  state: StateSchema.optional(),
});
export const UpdateInvariantPropertyValueSchema = z.object({
  tokenId: uuidSchema.optional(),
  value: z.string().trim().optional(),
  state: StateSchema.optional(),
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
  value: z.string().trim().min(1),
  states: z.any().optional(),
});
export const UpdateStyleCombinationSchema = z.object({
  value: z.string().trim().min(1).optional(),
  states: z.any().optional(),
});

// Style Combination Members
export const CreateStyleCombinationMemberSchema = z.object({
  combinationId: uuidSchema,
  styleId: uuidSchema,
});

// Design System Users
export const CreateDesignSystemUserSchema = z.object({
  userId: uuidSchema,
  designSystemId: uuidSchema,
});

// Design System Changes (audit log - create only, typically internal)
export const CreateDesignSystemChangeSchema = z.object({
  designSystemId: uuidSchema,
  userId: uuidSchema.optional(),
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
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
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
export type CreateDesignSystemUserRequest = z.infer<
  typeof CreateDesignSystemUserSchema
>;
export type CreateDesignSystemChangeRequest = z.infer<
  typeof CreateDesignSystemChangeSchema
>;
export type CreateSavedQueryRequest = z.infer<typeof CreateSavedQuerySchema>;
export type UpdateSavedQueryRequest = z.infer<typeof UpdateSavedQuerySchema>;
export type CreatePaletteRequest = z.infer<typeof CreatePaletteSchema>;
export type UpdatePaletteRequest = z.infer<typeof UpdatePaletteSchema>;
