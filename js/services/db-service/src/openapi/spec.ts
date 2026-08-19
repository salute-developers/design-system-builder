import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import * as s from "../validation/schema";
import * as tables from "../db/schema";
import { ImportRequestSchema } from "../db/import/commonConfig";

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

const ComponentStateSchema = registry.register(
  "ComponentState",
  createSelectSchema(tables.componentStates, ts).openapi("ComponentState"),
);

const PropertyValueStateSchema = registry.register(
  "PropertyValueState",
  createSelectSchema(tables.propertyValueStates, ts).openapi("PropertyValueState"),
);

const ComponentStyleReferenceSchema = registry.register(
  "ComponentStyleReference",
  createSelectSchema(tables.componentStyleReferences, ts).openapi("ComponentStyleReference"),
);

const ComponentStyleReferenceStyleSchema = registry.register(
  "ComponentStyleReferenceStyle",
  createSelectSchema(tables.componentStyleReferenceStyles, ts).openapi("ComponentStyleReferenceStyle"),
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
  CreateComponentState: registry.register("CreateComponentState", s.CreateComponentStateSchema.openapi("CreateComponentState")),
  UpdateComponentState: registry.register("UpdateComponentState", s.UpdateComponentStateSchema.openapi("UpdateComponentState")),
  CreatePropertyValueState: registry.register("CreatePropertyValueState", s.CreatePropertyValueStateSchema.openapi("CreatePropertyValueState")),
  CreateComponentStyleReference: registry.register("CreateComponentStyleReference", s.CreateComponentStyleReferenceSchema.openapi("CreateComponentStyleReference")),
  CreateComponentStyleReferenceStyle: registry.register("CreateComponentStyleReferenceStyle", s.CreateComponentStyleReferenceStyleSchema.openapi("CreateComponentStyleReferenceStyle")),
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

const DS_PREFIX = "/ds";
const ADMIN_PREFIX = "/admin";

// Health
registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  responses: { 200: { description: "OK", ...json(z.object({ status: z.literal("ok") })) } },
});

registerCrud(`${DS_PREFIX}/design-systems`, "Design Systems", DesignSystemSchema, schemas.CreateDesignSystem, schemas.UpdateDesignSystem);
for (const [sub, schema, tag] of [
  ["components", ComponentSchema, "Design Systems"],
  ["tokens", TokenSchema, "Design Systems"],
  ["tenants", TenantSchema, "Design Systems"],
  ["appearances", AppearanceSchema, "Design Systems"],
  ["changes", DesignSystemChangeSchema, "Design Systems"],
] as const) {
  registry.registerPath({
    method: "get",
    path: `${DS_PREFIX}/design-systems/{id}/${sub}`,
    tags: [tag as string],
    summary: `Get ${sub} for design system`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: list(schema as z.ZodTypeAny),
  });
}

registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/legacy/design-systems/{name}/theme-data`,
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
  path: `${DS_PREFIX}/legacy/design-systems/{name}/component-configs`,
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
  path: `${DS_PREFIX}/legacy/design-systems/create`,
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
  path: `${DS_PREFIX}/legacy/design-systems/{name}/tenant-params`,
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
  path: `${DS_PREFIX}/legacy/design-systems/{name}/update`,
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
  path: `${DS_PREFIX}/legacy/design-systems/{name}/download-theme`,
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

registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/component-config`,
  tags: ["Component Config"],
  summary: "Get a single component config (invariants, defaults, variations) for a design system / appearance",
  request: {
    query: z.object({
      ds: z.string().openapi({ example: "plasma_test" }),
      version: z.string().openapi({ example: "0.1.0" }),
      appearance: z.string().openapi({ example: "default" }),
      component: z.string().openapi({ example: "Button" }),
    }),
  },
  responses: {
    200: {
      description: "Component config",
      ...json(z.object({
        rootVariationId: z.string().nullable(),
        colorSchemeVariationId: z.string().nullable(),
        invariants: z.record(z.string(), z.any()),
        defaults: z.array(z.object({ id: z.string(), value: z.string() })),
        variations: z.array(z.any()),
      })),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registerCrud(`${DS_PREFIX}/design-system-versions`, "Design System Versions", DesignSystemVersionSchema, schemas.CreateDesignSystemVersion, schemas.UpdateDesignSystemVersion);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/design-system-versions/by-design-system/{designSystemId}`,
  tags: ["Design System Versions"],
  summary: "All versions for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: list(DesignSystemVersionSchema),
});

registerCrud(`${DS_PREFIX}/components`, "Components", ComponentSchema, schemas.CreateComponent, schemas.UpdateComponent);
for (const [sub, schema] of [
  ["variations", VariationSchema],
  ["properties", PropertySchema],
] as [string, z.ZodTypeAny][]) {
  registry.registerPath({
    method: "get",
    path: `${DS_PREFIX}/components/{id}/${sub}`,
    tags: ["Components"],
    summary: `Get ${sub} of a component`,
    request: { params: z.object({ id: UuidSchema }) },
    responses: list(schema),
  });
}
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/components/{id}/deps`,
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

registerCrud(`${DS_PREFIX}/design-system-components`, "Design System Components", DesignSystemComponentSchema, schemas.CreateDesignSystemComponent);

registerCrud(`${DS_PREFIX}/variations`, "Variations", VariationSchema, schemas.CreateVariation, schemas.UpdateVariation);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/variations/{id}/styles`,
  tags: ["Variations"],
  summary: "Styles for a variation",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(StyleSchema),
});
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/variations/{id}/properties`,
  tags: ["Variations"],
  summary: "Properties linked to a variation",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(PropertySchema),
});

registerCrud(`${DS_PREFIX}/properties`, "Properties", PropertySchema, schemas.CreateProperty, schemas.UpdateProperty);
registerCrud(`${DS_PREFIX}/property-platform-params`, "Property Platform Params", PropertyPlatformParamSchema, schemas.CreatePropertyPlatformParam, schemas.UpdatePropertyPlatformParam);
registerCrud(`${DS_PREFIX}/variation-platform-param-adjustments`, "Variation Platform Param Adjustments", VariationPlatformParamAdjustmentSchema, schemas.CreateVariationPlatformParamAdjustment, schemas.UpdateVariationPlatformParamAdjustment);
registerCrud(`${DS_PREFIX}/invariant-platform-param-adjustments`, "Invariant Platform Param Adjustments", InvariantPlatformParamAdjustmentSchema, schemas.CreateInvariantPlatformParamAdjustment, schemas.UpdateInvariantPlatformParamAdjustment);
registerCrud(`${DS_PREFIX}/property-variations`, "Property Variations", PropertyVariationSchema, schemas.CreatePropertyVariation);
registerCrud(`${DS_PREFIX}/appearances`, "Appearances", AppearanceSchema, schemas.CreateAppearance, schemas.UpdateAppearance);

registerCrud(`${DS_PREFIX}/styles`, "Styles", StyleSchema, schemas.CreateStyle, schemas.UpdateStyle);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/styles/by-variation/{variationId}/by-design-system/{designSystemId}`,
  tags: ["Styles"],
  summary: "Styles for variation x design system",
  request: { params: z.object({ variationId: UuidSchema, designSystemId: UuidSchema }) },
  responses: list(StyleSchema),
});

registerCrud(`${DS_PREFIX}/tokens`, "Tokens", TokenSchema, schemas.CreateToken, schemas.UpdateToken);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/tokens/{id}/values`,
  tags: ["Tokens"],
  summary: "All token values for a token",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(TokenValueSchema),
});

registerCrud(`${DS_PREFIX}/tenants`, "Tenants", TenantSchema, schemas.CreateTenant, schemas.UpdateTenant);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/tenants/{id}/token-values`,
  tags: ["Tenants"],
  summary: "All token values for a tenant",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(TokenValueSchema),
});

registerCrud(`${DS_PREFIX}/token-values`, "Token Values", TokenValueSchema, schemas.CreateTokenValue, schemas.UpdateTokenValue);

registerCrud(`${DS_PREFIX}/variation-property-values`, "Variation Property Values", VariationPropertyValueSchema, schemas.CreateVariationPropertyValue, schemas.UpdateVariationPropertyValue);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/variation-property-values/by-style/{styleId}`,
  tags: ["Variation Property Values"],
  summary: "Values for a style",
  request: { params: z.object({ styleId: UuidSchema }) },
  responses: list(VariationPropertyValueSchema),
});
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/variation-property-values/by-appearance/{appearanceId}`,
  tags: ["Variation Property Values"],
  summary: "Values for an appearance",
  request: { params: z.object({ appearanceId: UuidSchema }) },
  responses: list(VariationPropertyValueSchema),
});

registerCrud(`${DS_PREFIX}/invariant-property-values`, "Invariant Property Values", InvariantPropertyValueSchema, schemas.CreateInvariantPropertyValue, schemas.UpdateInvariantPropertyValue);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId}`,
  tags: ["Invariant Property Values"],
  summary: "Values for component x design system",
  request: { params: z.object({ componentId: UuidSchema, designSystemId: UuidSchema }) },
  responses: list(InvariantPropertyValueSchema),
});

registerCrud(`${DS_PREFIX}/documentation-pages`, "Documentation Pages", DocumentationPageSchema, schemas.CreateDocumentationPage, schemas.UpdateDocumentationPage);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/documentation-pages/by-design-system/{designSystemId}`,
  tags: ["Documentation Pages"],
  summary: "Documentation page for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: one(DocumentationPageSchema),
});

registerCrud(`${DS_PREFIX}/component-deps`, "Component Deps", ComponentDepSchema, schemas.CreateComponentDep, schemas.UpdateComponentDep);
registerCrud(`${DS_PREFIX}/component-reuse-configs`, "Component Reuse Configs", ComponentReuseConfigSchema, schemas.CreateComponentReuseConfig, schemas.UpdateComponentReuseConfig);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/component-reuse-configs/by-dep/{componentDepId}`,
  tags: ["Component Reuse Configs"],
  summary: "Configs for a component dep",
  request: { params: z.object({ componentDepId: UuidSchema }) },
  responses: list(ComponentReuseConfigSchema),
});

registerCrud(`${DS_PREFIX}/style-combinations`, "Style Combinations", StyleCombinationSchema, schemas.CreateStyleCombination, schemas.UpdateStyleCombination);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/style-combinations/{id}/members`,
  tags: ["Style Combinations"],
  summary: "Members of a style combination",
  request: { params: z.object({ id: UuidSchema }) },
  responses: list(StyleCombinationMemberSchema),
});
registry.registerPath({
  method: "post",
  path: `${DS_PREFIX}/style-combinations/{id}/members`,
  tags: ["Style Combinations"],
  summary: "Add style to combination",
  request: {
    params: z.object({ id: UuidSchema }),
    body: { required: true, ...json(schemas.CreateStyleCombinationMember) },
  },
  responses: created(StyleCombinationMemberSchema),
});

registerCrud(`${DS_PREFIX}/style-combination-members`, "Style Combination Members", StyleCombinationMemberSchema, schemas.CreateStyleCombinationMember);

// Остальные три таблицы (property_value_states, component_style_references,
// component_style_reference_styles) CRUD-маршрутов не имеют: их пишет импорт,
// поэтому в spec.ts они присутствуют только схемами ответа.
registerCrud(`${DS_PREFIX}/component-states`, "Component States", ComponentStateSchema, schemas.CreateComponentState, schemas.UpdateComponentState);
registerCrud(`${DS_PREFIX}/property-value-states`, "Property Value States", PropertyValueStateSchema, schemas.CreatePropertyValueState);

// Выборка связей по значению: нужна копированию дизайн-системы, которое переносит
// значение вместе с набором состояний.
for (const [suffix, description] of [
  ["by-variation-value", "variation property value"],
  ["by-invariant-value", "invariant property value"],
] as const) {
  registry.registerPath({
    method: "get",
    path: `${DS_PREFIX}/property-value-states/${suffix}/{id}`,
    tags: ["Property Value States"],
    summary: `List states of a ${description}`,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Property value states", ...json(z.array(PropertyValueStateSchema)) },
      500: { description: "Server error", ...json(ErrorResponseSchema) },
    },
  });
}

// Design System Changes (audit log -- no update/delete)
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/design-system-changes`,
  tags: ["Design System Changes"],
  summary: "List all changes",
  responses: list(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "post",
  path: `${DS_PREFIX}/design-system-changes`,
  tags: ["Design System Changes"],
  summary: "Record a change",
  request: { body: { required: true, ...json(schemas.CreateDesignSystemChange) } },
  responses: created(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/design-system-changes/{id}`,
  tags: ["Design System Changes"],
  summary: "Get change by ID",
  request: { params: z.object({ id: UuidSchema }) },
  responses: one(DesignSystemChangeSchema),
});
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/design-system-changes/by-design-system/{designSystemId}`,
  tags: ["Design System Changes"],
  summary: "Audit log for a design system",
  request: { params: z.object({ designSystemId: UuidSchema }) },
  responses: list(DesignSystemChangeSchema),
});

registerCrud(`${DS_PREFIX}/saved-queries`, "Saved Queries", SavedQuerySchema, schemas.CreateSavedQuery, schemas.UpdateSavedQuery);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/saved-queries/{id}/run`,
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

registerCrud(`${DS_PREFIX}/palette`, "Palette", PaletteSchema, schemas.CreatePalette, schemas.UpdatePalette);
registry.registerPath({
  method: "get",
  path: `${DS_PREFIX}/palette/by-type/{type}`,
  tags: ["Palette"],
  summary: "Filter palette by type",
  request: { params: z.object({ type: s.PaletteTypeSchema }) },
  responses: list(PaletteSchema),
});

// ─── Admin (introspection / catalog / NL query) ──────────────────────────────

const TableSummarySchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  count: z.number(),
});

registry.registerPath({
  method: "get",
  path: `${ADMIN_PREFIX}/tables`,
  tags: ["Admin"],
  summary: "List all tables with columns and row counts",
  responses: {
    200: { description: "Tables", ...json(z.object({ tables: z.array(TableSummarySchema) })) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});
registry.registerPath({
  method: "get",
  path: `${ADMIN_PREFIX}/tables/{name}`,
  tags: ["Admin"],
  summary: "Paginated rows for a single table",
  request: {
    params: z.object({ name: z.string() }),
    query: z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
      all: z.string().optional(),
    }),
  },
  responses: {
    200: { description: "Rows", ...json(z.object({ rows: z.array(z.record(z.string(), z.any())) })) },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

const CatalogQueryParamSchema = z.object({
  name: z.string(),
  type: z.string(),
  default: z.any().optional(),
  options: z.array(z.any()).optional(),
});

const CatalogQuerySchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  params: z.array(CatalogQueryParamSchema).optional(),
});

registry.registerPath({
  method: "get",
  path: `${ADMIN_PREFIX}/queries`,
  tags: ["Admin"],
  summary: "List queries from the catalog",
  responses: {
    200: { description: "Queries", ...json(z.object({ queries: z.array(CatalogQuerySchema) })) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});
registry.registerPath({
  method: "get",
  path: `${ADMIN_PREFIX}/queries/{id}`,
  tags: ["Admin"],
  summary: "Run a catalog query",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: "Result",
      ...json(z.object({
        id: z.string(),
        label: z.string(),
        result: z.any(),
        count: z.number(),
      })),
    },
    404: { description: "Not found", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: `${ADMIN_PREFIX}/nl-query`,
  tags: ["Admin"],
  summary: "Run a natural-language SQL query",
  request: {
    body: {
      required: true,
      ...json(z.object({ query: z.string().min(1) })),
    },
  },
  responses: {
    200: {
      description: "Generated SQL and result rows",
      ...json(z.object({
        sql: z.string(),
        columns: z.array(z.string()),
        rows: z.array(z.record(z.string(), z.any())),
        count: z.number(),
      })),
    },
    400: { description: "Validation / generation error", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: `${ADMIN_PREFIX}/schema`,
  tags: ["Admin"],
  summary: "Drizzle schema as DBML and Mermaid ER",
  responses: {
    200: {
      description: "Schema text",
      ...json(z.object({ dbml: z.string(), mermaid: z.string() })),
    },
  },
});

// ─── Импорт компонентов ───────────────────────────────────────────────────────

const ImportReportSchema = registry.register(
  "ComponentImportReport",
  z
    .object({
      created: z.number().openapi({ description: "Конфигураций создано" }),
      updated: z.number().openapi({ description: "Конфигураций обновлено" }),
      unchanged: z.number().openapi({ description: "Конфигураций без изменений" }),
      rejected: z.array(
        z.object({
          componentName: z.string(),
          styleName: z.string(),
          reason: z.string(),
        }),
      ),
      unresolvedTokens: z
        .array(z.string())
        .openapi({ description: "Имена токенов, не найденные в дизайн-системе. Значение сохранено текстом, ссылка пуста" }),
      unresolvedComponentStyles: z
        .array(z.string())
        .openapi({ description: "Ссылки component_style, чей стиль не сопоставлен компоненту" }),
      unknownProperties: z
        .array(z.string())
        .openapi({ description: "Свойства из конфигураций, отсутствующие в глобальном слое: расхождение дизайна и кода" }),
    })
    .openapi("ComponentImportReport"),
);

registry.registerPath({
  method: "post",
  path: `${DS_PREFIX}/component-config/import`,
  tags: ["Component Config"],
  summary: "Импорт конфигураций компонентов одним запросом",
  description: [
    "Загружает пакет конфигураций компонентов в дизайн-систему. Вся работа выполняется",
    "в одной транзакции: частично применённый импорт компонентной модели хуже отказа.",
    "",
    "Дизайн-система адресуется полем designSystemId тела запроса.",
    "",
    "Ключ upsert — пара (componentName, styleName); styleName соответствует appearance.",
    "Импорт авторитетен для appearance: прежние значения удаляются перед записью, поэтому",
    "свойство, снятое из конфигурации, исчезает и из базы. Глобальный слой (components,",
    "variations, properties) остаётся аддитивным и не переписывается.",
    "",
    "При dryRun=true выполняется та же работа, после чего транзакция откатывается,",
    "поэтому отчёт плана совпадает с отчётом применения.",
    "",
    "Глобальный слой — компоненты и их свойства — импорт не создаёт: он наполняется из",
    "uikit-api-meta.json скриптом scripts/import-uikit-api-meta.sh. Конфигурация компонента,",
    "которого нет в глобальном слое, отклоняется; отсутствующие свойства попадают в",
    "unknownProperties, остальная часть конфигурации грузится.",
    "",
    "Требует scope components:write, если запрос пришёл с ключом проекта.",
  ].join("\n"),
  request: {
    body: { required: true, ...json(ImportRequestSchema) },
  },
  responses: {
    200: { description: "Отчёт импорта", ...json(ImportReportSchema) },
    400: { description: "Тело запроса не соответствует формату или designSystemId не является uuid", ...json(ErrorResponseSchema) },
    403: { description: "У ключа нет scope components:write", ...json(ErrorResponseSchema) },
    404: { description: "Дизайн-система не найдена или недоступна проекту", ...json(ErrorResponseSchema) },
    422: { description: "Импорт отклонён при записи", ...json(ErrorResponseSchema) },
    500: { description: "Server error", ...json(ErrorResponseSchema) },
  },
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
