import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import * as s from "../validation/schema";
import * as tables from "../db/schema";

const registry = new OpenAPIRegistry();

// ─── Common schemas ──────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" });
const DateTimeSchema = z.string().datetime().openapi({ example: "2024-01-01T00:00:00.000Z" });

const OkResponseSchema = registry.register(
  "OkResponse",
  z.object({ ok: z.literal(true) }).openapi("OkResponse"),
);

const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({ error: z.union([z.string(), z.record(z.string(), z.any())]) }).openapi("ErrorResponse"),
);

// ─── Entity response schemas (auto-generated from Drizzle tables) ─────────────

const ts = { createdAt: DateTimeSchema, updatedAt: DateTimeSchema };

const UserSchema = registry.register(
  "User",
  createSelectSchema(tables.users, ts).openapi("User"),
);

const DesignSystemSchema = registry.register(
  "DesignSystem",
  createSelectSchema(tables.designSystems, ts).openapi("DesignSystem"),
);

const DesignSystemVersionSchema = registry.register(
  "DesignSystemVersion",
  createSelectSchema(tables.designSystemVersions, {
    publishedAt: DateTimeSchema,
  }).openapi("DesignSystemVersion"),
);

const ComponentSchema = registry.register(
  "Component",
  createSelectSchema(tables.components, ts).openapi("Component"),
);

const DesignSystemComponentSchema = registry.register(
  "DesignSystemComponent",
  createSelectSchema(tables.designSystemComponents, ts).openapi("DesignSystemComponent"),
);

const VariationSchema = registry.register(
  "Variation",
  createSelectSchema(tables.variations, ts).openapi("Variation"),
);

const PropertySchema = registry.register(
  "Property",
  createSelectSchema(tables.properties, ts).openapi("Property"),
);

const PropertyPlatformParamSchema = registry.register(
  "PropertyPlatformParam",
  createSelectSchema(tables.propertyPlatformParams, ts).openapi("PropertyPlatformParam"),
);

const VariationPlatformParamAdjustmentSchema = registry.register(
  "VariationPlatformParamAdjustment",
  createSelectSchema(tables.variationPlatformParamAdjustments, ts).openapi("VariationPlatformParamAdjustment"),
);

const InvariantPlatformParamAdjustmentSchema = registry.register(
  "InvariantPlatformParamAdjustment",
  createSelectSchema(tables.invariantPlatformParamAdjustments, ts).openapi("InvariantPlatformParamAdjustment"),
);

const PropertyVariationSchema = registry.register(
  "PropertyVariation",
  createSelectSchema(tables.propertyVariations, ts).openapi("PropertyVariation"),
);

const AppearanceSchema = registry.register(
  "Appearance",
  createSelectSchema(tables.appearances, ts).openapi("Appearance"),
);

const StyleSchema = registry.register(
  "Style",
  createSelectSchema(tables.styles, ts).openapi("Style"),
);

const TokenSchema = registry.register(
  "Token",
  createSelectSchema(tables.tokens, ts).openapi("Token"),
);

const TenantSchema = registry.register(
  "Tenant",
  createSelectSchema(tables.tenants, ts).openapi("Tenant"),
);

const TokenValueSchema = registry.register(
  "TokenValue",
  createSelectSchema(tables.tokenValues, ts).openapi("TokenValue"),
);

const VariationPropertyValueSchema = registry.register(
  "VariationPropertyValue",
  createSelectSchema(tables.variationPropertyValues, ts).openapi("VariationPropertyValue"),
);

const InvariantPropertyValueSchema = registry.register(
  "InvariantPropertyValue",
  createSelectSchema(tables.invariantPropertyValues, ts).openapi("InvariantPropertyValue"),
);

const DocumentationPageSchema = registry.register(
  "DocumentationPage",
  createSelectSchema(tables.documentationPages, ts).openapi("DocumentationPage"),
);

const ComponentDepSchema = registry.register(
  "ComponentDep",
  createSelectSchema(tables.componentDeps, ts).openapi("ComponentDep"),
);

const ComponentReuseConfigSchema = registry.register(
  "ComponentReuseConfig",
  createSelectSchema(tables.componentReuseConfigs, ts).openapi("ComponentReuseConfig"),
);

const StyleCombinationSchema = registry.register(
  "StyleCombination",
  createSelectSchema(tables.styleCombinations, ts).openapi("StyleCombination"),
);

const StyleCombinationMemberSchema = registry.register(
  "StyleCombinationMember",
  createSelectSchema(tables.styleCombinationMembers, ts).openapi("StyleCombinationMember"),
);

const DesignSystemUserSchema = registry.register(
  "DesignSystemUser",
  createSelectSchema(tables.designSystemUsers, ts).openapi("DesignSystemUser"),
);

const DesignSystemChangeSchema = registry.register(
  "DesignSystemChange",
  createSelectSchema(tables.designSystemChanges, ts).openapi("DesignSystemChange"),
);

const SavedQuerySchema = registry.register(
  "SavedQuery",
  createSelectSchema(tables.savedQueries, { createdAt: DateTimeSchema }).openapi("SavedQuery"),
);

const PaletteSchema = registry.register(
  "Palette",
  createSelectSchema(tables.palette, ts).openapi("Palette"),
);

// ─── Request schemas (register with .openapi() names) ─────────────────────────

const schemas = {
  CreateUser: registry.register("CreateUser", s.CreateUserSchema.openapi("CreateUser")),
  UpdateUser: registry.register("UpdateUser", s.UpdateUserSchema.openapi("UpdateUser")),
  CreateDesignSystem: registry.register("CreateDesignSystem", s.CreateDesignSystemSchema.openapi("CreateDesignSystem")),
  UpdateDesignSystem: registry.register("UpdateDesignSystem", s.UpdateDesignSystemSchema.openapi("UpdateDesignSystem")),
  CreateDesignSystemVersion: registry.register("CreateDesignSystemVersion", s.CreateDesignSystemVersionSchema.openapi("CreateDesignSystemVersion")),
  UpdateDesignSystemVersion: registry.register("UpdateDesignSystemVersion", s.UpdateDesignSystemVersionSchema.openapi("UpdateDesignSystemVersion")),
  CreateComponent: registry.register("CreateComponent", s.CreateComponentSchema.openapi("CreateComponent")),
  UpdateComponent: registry.register("UpdateComponent", s.UpdateComponentSchema.openapi("UpdateComponent")),
  CreateDesignSystemComponent: registry.register("CreateDesignSystemComponent", s.CreateDesignSystemComponentSchema.openapi("CreateDesignSystemComponent")),
  CreateVariation: registry.register("CreateVariation", s.CreateVariationSchema.openapi("CreateVariation")),
  UpdateVariation: registry.register("UpdateVariation", s.UpdateVariationSchema.openapi("UpdateVariation")),
  CreateProperty: registry.register("CreateProperty", s.CreatePropertySchema.openapi("CreateProperty")),
  UpdateProperty: registry.register("UpdateProperty", s.UpdatePropertySchema.openapi("UpdateProperty")),
  CreatePropertyPlatformParam: registry.register("CreatePropertyPlatformParam", s.CreatePropertyPlatformParamSchema.openapi("CreatePropertyPlatformParam")),
  UpdatePropertyPlatformParam: registry.register("UpdatePropertyPlatformParam", s.UpdatePropertyPlatformParamSchema.openapi("UpdatePropertyPlatformParam")),
  CreateVariationPlatformParamAdjustment: registry.register("CreateVariationPlatformParamAdjustment", s.CreateVariationPlatformParamAdjustmentSchema.openapi("CreateVariationPlatformParamAdjustment")),
  UpdateVariationPlatformParamAdjustment: registry.register("UpdateVariationPlatformParamAdjustment", s.UpdateVariationPlatformParamAdjustmentSchema.openapi("UpdateVariationPlatformParamAdjustment")),
  CreateInvariantPlatformParamAdjustment: registry.register("CreateInvariantPlatformParamAdjustment", s.CreateInvariantPlatformParamAdjustmentSchema.openapi("CreateInvariantPlatformParamAdjustment")),
  UpdateInvariantPlatformParamAdjustment: registry.register("UpdateInvariantPlatformParamAdjustment", s.UpdateInvariantPlatformParamAdjustmentSchema.openapi("UpdateInvariantPlatformParamAdjustment")),
  CreatePropertyVariation: registry.register("CreatePropertyVariation", s.CreatePropertyVariationSchema.openapi("CreatePropertyVariation")),
  CreateAppearance: registry.register("CreateAppearance", s.CreateAppearanceSchema.openapi("CreateAppearance")),
  UpdateAppearance: registry.register("UpdateAppearance", s.UpdateAppearanceSchema.openapi("UpdateAppearance")),
  CreateStyle: registry.register("CreateStyle", s.CreateStyleSchema.openapi("CreateStyle")),
  UpdateStyle: registry.register("UpdateStyle", s.UpdateStyleSchema.openapi("UpdateStyle")),
  CreateToken: registry.register("CreateToken", s.CreateTokenSchema.openapi("CreateToken")),
  UpdateToken: registry.register("UpdateToken", s.UpdateTokenSchema.openapi("UpdateToken")),
  CreateTenant: registry.register("CreateTenant", s.CreateTenantSchema.openapi("CreateTenant")),
  UpdateTenant: registry.register("UpdateTenant", s.UpdateTenantSchema.openapi("UpdateTenant")),
  CreateTokenValue: registry.register("CreateTokenValue", s.CreateTokenValueSchema.openapi("CreateTokenValue")),
  UpdateTokenValue: registry.register("UpdateTokenValue", s.UpdateTokenValueSchema.openapi("UpdateTokenValue")),
  CreateVariationPropertyValue: registry.register("CreateVariationPropertyValue", s.CreateVariationPropertyValueSchema.openapi("CreateVariationPropertyValue")),
  UpdateVariationPropertyValue: registry.register("UpdateVariationPropertyValue", s.UpdateVariationPropertyValueSchema.openapi("UpdateVariationPropertyValue")),
  CreateInvariantPropertyValue: registry.register("CreateInvariantPropertyValue", s.CreateInvariantPropertyValueSchema.openapi("CreateInvariantPropertyValue")),
  UpdateInvariantPropertyValue: registry.register("UpdateInvariantPropertyValue", s.UpdateInvariantPropertyValueSchema.openapi("UpdateInvariantPropertyValue")),
  CreateDocumentationPage: registry.register("CreateDocumentationPage", s.CreateDocumentationPageSchema.openapi("CreateDocumentationPage")),
  UpdateDocumentationPage: registry.register("UpdateDocumentationPage", s.UpdateDocumentationPageSchema.openapi("UpdateDocumentationPage")),
  CreateComponentDep: registry.register("CreateComponentDep", s.CreateComponentDepSchema.openapi("CreateComponentDep")),
  UpdateComponentDep: registry.register("UpdateComponentDep", s.UpdateComponentDepSchema.openapi("UpdateComponentDep")),
  CreateComponentReuseConfig: registry.register("CreateComponentReuseConfig", s.CreateComponentReuseConfigSchema.openapi("CreateComponentReuseConfig")),
  UpdateComponentReuseConfig: registry.register("UpdateComponentReuseConfig", s.UpdateComponentReuseConfigSchema.openapi("UpdateComponentReuseConfig")),
  CreateStyleCombination: registry.register("CreateStyleCombination", s.CreateStyleCombinationSchema.openapi("CreateStyleCombination")),
  UpdateStyleCombination: registry.register("UpdateStyleCombination", s.UpdateStyleCombinationSchema.openapi("UpdateStyleCombination")),
  CreateStyleCombinationMember: registry.register("CreateStyleCombinationMember", s.CreateStyleCombinationMemberSchema.openapi("CreateStyleCombinationMember")),
  CreateDesignSystemUser: registry.register("CreateDesignSystemUser", s.CreateDesignSystemUserSchema.openapi("CreateDesignSystemUser")),
  CreateDesignSystemChange: registry.register("CreateDesignSystemChange", s.CreateDesignSystemChangeSchema.openapi("CreateDesignSystemChange")),
  CreateSavedQuery: registry.register("CreateSavedQuery", s.CreateSavedQuerySchema.openapi("CreateSavedQuery")),
  UpdateSavedQuery: registry.register("UpdateSavedQuery", s.UpdateSavedQuerySchema.openapi("UpdateSavedQuery")),
  CreatePalette: registry.register("CreatePalette", s.CreatePaletteSchema.openapi("CreatePalette")),
  UpdatePalette: registry.register("UpdatePalette", s.UpdatePaletteSchema.openapi("UpdatePalette")),
};

// ─── Path helpers ─────────────────────────────────────────────────────────────

const json = (schema: z.ZodTypeAny) => ({
  content: { "application/json": { schema } },
});

const list = (schema: z.ZodTypeAny) => ({
  200: { description: "List of items", ...json(z.array(schema)) },
  500: { description: "Server error", ...json(ErrorResponseSchema) },
});

const one = (schema: z.ZodTypeAny) => ({
  200: { description: "Item", ...json(schema) },
  404: { description: "Not found", ...json(ErrorResponseSchema) },
  500: { description: "Server error", ...json(ErrorResponseSchema) },
});

const created = (schema: z.ZodTypeAny) => ({
  201: { description: "Created", ...json(schema) },
  400: { description: "Validation error", ...json(ErrorResponseSchema) },
  500: { description: "Server error", ...json(ErrorResponseSchema) },
});

const updated = (schema: z.ZodTypeAny) => ({
  200: { description: "Updated", ...json(schema) },
  400: { description: "Validation error", ...json(ErrorResponseSchema) },
  404: { description: "Not found", ...json(ErrorResponseSchema) },
  500: { description: "Server error", ...json(ErrorResponseSchema) },
});

const deleted = () => ({
  200: { description: "Deleted", ...json(OkResponseSchema) },
  404: { description: "Not found", ...json(ErrorResponseSchema) },
  500: { description: "Server error", ...json(ErrorResponseSchema) },
});

const registerCrud = (
  basePath: string,
  tag: string,
  responseSchema: z.ZodTypeAny,
  createSchema: z.ZodTypeAny,
  updateSchema?: z.ZodTypeAny,
) => {
  registry.registerPath({
    method: "get",
    path: basePath,
    tags: [tag],
    summary: `List all ${tag.toLowerCase()}`,
    responses: list(responseSchema),
  });

  registry.registerPath({
    method: "post",
    path: basePath,
    tags: [tag],
    summary: `Create ${tag.toLowerCase().replace(/s$/, "")}`,
    request: { body: { required: true, ...json(createSchema) } },
    responses: created(responseSchema),
  });

  registry.registerPath({
    method: "get",
    path: `${basePath}/{id}`,
    tags: [tag],
    summary: `Get ${tag.toLowerCase().replace(/s$/, "")} by ID`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: one(responseSchema),
  });

  if (updateSchema) {
    registry.registerPath({
      method: "patch",
      path: `${basePath}/{id}`,
      tags: [tag],
      summary: `Update ${tag.toLowerCase().replace(/s$/, "")}`,
      request: {
        params: z.object({ id: UuidSchema }),
        body: { required: true, ...json(updateSchema) },
      },
      responses: updated(responseSchema),
    });
  }

  registry.registerPath({
    method: "delete",
    path: `${basePath}/{id}`,
    tags: [tag],
    summary: `Delete ${tag.toLowerCase().replace(/s$/, "")}`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: deleted(),
  });
};

// ─── Register all CRUD routes ─────────────────────────────────────────────────

// Health
registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  responses: { 200: { description: "OK", ...json(z.object({ status: z.literal("ok") })) } },
});

registerCrud("/users", "Users", UserSchema, schemas.CreateUser, schemas.UpdateUser);
registry.registerPath({
  method: "get",
  path: "/users/{id}/design-systems",
  tags: ["Users"],
  summary: "Design systems accessible to a user",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(DesignSystemSchema),
});

registerCrud("/design-systems", "Design Systems", DesignSystemSchema, schemas.CreateDesignSystem, schemas.UpdateDesignSystem);
for (const [sub, schema, tag] of [
  ["components", ComponentSchema, "Design Systems"],
  ["tokens", TokenSchema, "Design Systems"],
  ["tenants", TenantSchema, "Design Systems"],
  ["appearances", AppearanceSchema, "Design Systems"],
  ["users", UserSchema, "Design Systems"],
  ["changes", DesignSystemChangeSchema, "Design Systems"],
] as const) {
  registry.registerPath({
    method: "get",
    path: `/design-systems/{id}/${sub}`,
    tags: [tag as string],
    summary: `Get ${sub} for design system`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: list(schema as z.ZodTypeAny),
  });
}

registry.registerPath({
  method: "get",
  path: "/legacy/design-systems/{name}/theme-data",
  tags: ["Legacy"],
  summary: "Get theme data for a design system (legacy)",
  request: { params: z.object({ name: z.string().openapi({ example: "plasma_test" }) }) },
  responses: {
    200: {
      description: "Design system config",
      ...json(z.object({ meta: z.any(), variations: z.record(z.string(), z.any()) })),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/legacy/design-systems/{name}/component-configs",
  tags: ["Legacy"],
  summary: "Get components with full sources (api, variations, configs) for a design system (legacy)",
  request: { params: z.object({ name: z.string().openapi({ example: "plasma_test" }) }) },
  responses: {
    200: {
      description: "Components sources",
      ...json(z.array(z.any())),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/legacy/design-systems/create",
  tags: ["Legacy"],
  summary: "Create a design system from legacy JSON structure",
  request: { body: { required: true, ...json(z.any()) } },
  responses: {
    201: { description: "Created", ...json(z.object({ id: UuidSchema })) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/legacy/design-systems/{name}/tenant-params",
  tags: ["Legacy"],
  summary: "Get tenant parameters for a design system (legacy)",
  request: { params: z.object({ name: z.string().openapi({ example: "plasma_test" }) }) },
  responses: {
    200: {
      description: "Tenant parameters",
      ...json(z.object({
        projectName: z.string(),
        packagesName: z.string(),
        grayTone: z.string().nullable(),
        accentColor: z.string().nullable(),
        lightStrokeSaturation: z.number().nullable(),
        lightFillSaturation: z.number().nullable(),
        darkStrokeSaturation: z.number().nullable(),
        darkFillSaturation: z.number().nullable(),
      })),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/legacy/design-systems/{name}/update",
  tags: ["Legacy"],
  summary: "Update an existing design system from legacy JSON structure",
  request: {
    params: z.object({ name: z.string().openapi({ example: "plasma_test" }) }),
    body: { required: true, ...json(z.any()) },
  },
  responses: {
    200: { description: "Updated", ...json(z.object({ id: UuidSchema })) },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/legacy/design-systems/{name}/download-theme",
  tags: ["Legacy"],
  summary: "Download theme as ZIP archive (legacy)",
  request: { params: z.object({ name: z.string().openapi({ example: "plasma_test" }) }) },
  responses: {
    200: {
      description: "ZIP archive with theme files",
      content: { "application/zip": { schema: z.any() } },
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registerCrud("/design-system-versions", "Design System Versions", DesignSystemVersionSchema, schemas.CreateDesignSystemVersion, schemas.UpdateDesignSystemVersion);
registry.registerPath({
  method: "get",
  path: "/design-system-versions/by-design-system/{designSystemId}",
  tags: ["Design System Versions"],
  summary: "All versions for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: list(DesignSystemVersionSchema),
});

registerCrud("/components", "Components", ComponentSchema, schemas.CreateComponent, schemas.UpdateComponent);
for (const [sub, schema] of [
  ["variations", VariationSchema],
  ["properties", PropertySchema],
] as [string, z.ZodTypeAny][]) {
  registry.registerPath({
    method: "get",
    path: `/components/{id}/${sub}`,
    tags: ["Components"],
    summary: `Get ${sub} of a component`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: list(schema),
  });
}
registry.registerPath({
  method: "get",
  path: "/components/{id}/deps",
  tags: ["Components"],
  summary: "Parent and child deps of a component",
  request: { params: z.object({ id: UuidSchema }) },
  responses: {
    200: {
      description: "Deps",
      ...json(z.object({ asParent: z.array(ComponentDepSchema), asChild: z.array(ComponentDepSchema) })),
    },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registerCrud("/design-system-components", "Design System Components", DesignSystemComponentSchema, schemas.CreateDesignSystemComponent);

registerCrud("/variations", "Variations", VariationSchema, schemas.CreateVariation, schemas.UpdateVariation);
registry.registerPath({
  method: "get",
  path: "/variations/{id}/styles",
  tags: ["Variations"],
  summary: "Styles for a variation",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(StyleSchema),
});
registry.registerPath({
  method: "get",
  path: "/variations/{id}/properties",
  tags: ["Variations"],
  summary: "Properties linked to a variation",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(PropertySchema),
});

registerCrud("/properties", "Properties", PropertySchema, schemas.CreateProperty, schemas.UpdateProperty);
registerCrud("/property-platform-params", "Property Platform Params", PropertyPlatformParamSchema, schemas.CreatePropertyPlatformParam, schemas.UpdatePropertyPlatformParam);
registerCrud("/variation-platform-param-adjustments", "Variation Platform Param Adjustments", VariationPlatformParamAdjustmentSchema, schemas.CreateVariationPlatformParamAdjustment, schemas.UpdateVariationPlatformParamAdjustment);
registerCrud("/invariant-platform-param-adjustments", "Invariant Platform Param Adjustments", InvariantPlatformParamAdjustmentSchema, schemas.CreateInvariantPlatformParamAdjustment, schemas.UpdateInvariantPlatformParamAdjustment);
registerCrud("/property-variations", "Property Variations", PropertyVariationSchema, schemas.CreatePropertyVariation);
registerCrud("/appearances", "Appearances", AppearanceSchema, schemas.CreateAppearance, schemas.UpdateAppearance);

registerCrud("/styles", "Styles", StyleSchema, schemas.CreateStyle, schemas.UpdateStyle);
registry.registerPath({
  method: "get",
  path: "/styles/by-variation/{variationId}/by-design-system/{designSystemId}",
  tags: ["Styles"],
  summary: "Styles for variation x design system",
  request: { params: z.object({ variationId: UuidSchema, designSystemId: UuidSchema }) },
  responses: list(StyleSchema),
});

registerCrud("/tokens", "Tokens", TokenSchema, schemas.CreateToken, schemas.UpdateToken);
registry.registerPath({
  method: "get",
  path: "/tokens/{id}/values",
  tags: ["Tokens"],
  summary: "All token values for a token",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(TokenValueSchema),
});

registerCrud("/tenants", "Tenants", TenantSchema, schemas.CreateTenant, schemas.UpdateTenant);
registry.registerPath({
  method: "get",
  path: "/tenants/{id}/token-values",
  tags: ["Tenants"],
  summary: "All token values for a tenant",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(TokenValueSchema),
});

registerCrud("/token-values", "Token Values", TokenValueSchema, schemas.CreateTokenValue, schemas.UpdateTokenValue);

registerCrud("/variation-property-values", "Variation Property Values", VariationPropertyValueSchema, schemas.CreateVariationPropertyValue, schemas.UpdateVariationPropertyValue);
registry.registerPath({
  method: "get",
  path: "/variation-property-values/by-style/{styleId}",
  tags: ["Variation Property Values"],
  summary: "Values for a style",
  request: { params: z.object({ styleId: UuidSchema }) },
  responses: list(VariationPropertyValueSchema),
});
registry.registerPath({
  method: "get",
  path: "/variation-property-values/by-appearance/{appearanceId}",
  tags: ["Variation Property Values"],
  summary: "Values for an appearance",
  request: { params: z.object({ appearanceId: UuidSchema }) },
  responses: list(VariationPropertyValueSchema),
});

registerCrud("/invariant-property-values", "Invariant Property Values", InvariantPropertyValueSchema, schemas.CreateInvariantPropertyValue, schemas.UpdateInvariantPropertyValue);
registry.registerPath({
  method: "get",
  path: "/invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId}",
  tags: ["Invariant Property Values"],
  summary: "Values for component x design system",
  request: { params: z.object({ componentId: UuidSchema, designSystemId: UuidSchema }) },
  responses: list(InvariantPropertyValueSchema),
});

registerCrud("/documentation-pages", "Documentation Pages", DocumentationPageSchema, schemas.CreateDocumentationPage, schemas.UpdateDocumentationPage);
registry.registerPath({
  method: "get",
  path: "/documentation-pages/by-design-system/{designSystemId}",
  tags: ["Documentation Pages"],
  summary: "Documentation page for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: one(DocumentationPageSchema),
});

registerCrud("/component-deps", "Component Deps", ComponentDepSchema, schemas.CreateComponentDep, schemas.UpdateComponentDep);
registerCrud("/component-reuse-configs", "Component Reuse Configs", ComponentReuseConfigSchema, schemas.CreateComponentReuseConfig, schemas.UpdateComponentReuseConfig);
registry.registerPath({
  method: "get",
  path: "/component-reuse-configs/by-dep/{componentDepId}",
  tags: ["Component Reuse Configs"],
  summary: "Configs for a component dep",
  request: { params: z.object({ componentDepId: UuidSchema }) },
  responses: list(ComponentReuseConfigSchema),
});

registerCrud("/style-combinations", "Style Combinations", StyleCombinationSchema, schemas.CreateStyleCombination, schemas.UpdateStyleCombination);
registry.registerPath({
  method: "get",
  path: "/style-combinations/{id}/members",
  tags: ["Style Combinations"],
  summary: "Members of a style combination",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(StyleCombinationMemberSchema),
});
registry.registerPath({
  method: "post",
  path: "/style-combinations/{id}/members",
  tags: ["Style Combinations"],
  summary: "Add style to combination",
  request: {
    params: z.object({ id: UuidSchema }),
    body: { required: true, ...json(schemas.CreateStyleCombinationMember) },
  },
  responses: created(StyleCombinationMemberSchema),
});

registerCrud("/style-combination-members", "Style Combination Members", StyleCombinationMemberSchema, schemas.CreateStyleCombinationMember);
registerCrud("/design-system-users", "Design System Users", DesignSystemUserSchema, schemas.CreateDesignSystemUser);

// Design System Changes (audit log -- no update/delete)
registry.registerPath({
  method: "get",
  path: "/design-system-changes",
  tags: ["Design System Changes"],
  summary: "List all changes",
  responses: list(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "post",
  path: "/design-system-changes",
  tags: ["Design System Changes"],
  summary: "Record a change",
  request: { body: { required: true, ...json(schemas.CreateDesignSystemChange) } },
  responses: created(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "get",
  path: "/design-system-changes/{id}",
  tags: ["Design System Changes"],
  summary: "Get change by ID",
  request: { params: z.object({ id: UuidSchema }) },
  responses: one(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "get",
  path: "/design-system-changes/by-design-system/{designSystemId}",
  tags: ["Design System Changes"],
  summary: "Audit log for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: list(DesignSystemChangeSchema),
});

registerCrud("/saved-queries", "Saved Queries", SavedQuerySchema, schemas.CreateSavedQuery, schemas.UpdateSavedQuery);
registry.registerPath({
  method: "get",
  path: "/saved-queries/{id}/run",
  tags: ["Saved Queries"],
  summary: "Execute a saved query",
  request: { params: z.object({ id: UuidSchema }) },
  responses: {
    200: {
      description: "Query results",
      ...json(z.object({ id: UuidSchema, label: z.string(), result: z.array(z.record(z.string(), z.any())), count: z.number() })),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registerCrud("/palette", "Palette", PaletteSchema, schemas.CreatePalette, schemas.UpdatePalette);
registry.registerPath({
  method: "get",
  path: "/palette/by-type/{type}",
  tags: ["Palette"],
  summary: "Filter palette by type",
  request: { params: z.object({ type: s.PaletteTypeSchema }) },
  responses: list(PaletteSchema),
});

// ─── Generate and export spec ─────────────────────────────────────────────────

const generator = new OpenApiGeneratorV3(registry.definitions);

export const spec = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Admin API",
    version: "1.0.0",
    description: "Design system management API",
  },
  servers: [{ url: "/api", description: "API server" }],
});
