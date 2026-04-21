import { eq, and, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";

type DB = PostgresJsDatabase<typeof schema>;

interface QueryParam {
  name: string;
  type: "string" | "number";
  default?: any;
  context?: {
    query: (db: DB) => Promise<{ value: string; label: string }[]>;
  };
}

export interface CatalogQuery {
  id: string;
  label: string;
  type: "get" | "post" | "delete" | "put";
  params?: QueryParam[];
  run: (db: DB, params?: Record<string, any>) => Promise<any>;
}

// ─── Reusable context queries ────────────────────────────────────────────────

const dsNameContext = {
  query: async (db: DB) =>
    (
      await db
        .select({ name: schema.designSystems.name })
        .from(schema.designSystems)
    ).map((r) => ({ value: r.name, label: r.name })),
};

const componentNameContext = {
  query: async (db: DB) =>
    (
      await db
        .select({ name: schema.components.name })
        .from(schema.components)
    ).map((r) => ({ value: r.name, label: r.name })),
};

const userLoginContext = {
  query: async (db: DB) =>
    (
      await db.select({ login: schema.users.login }).from(schema.users)
    ).map((r) => ({ value: r.login, label: r.login })),
};

const appearanceNameContext = {
  query: async (db: DB) =>
    (
      await db
        .selectDistinct({ name: schema.appearances.name })
        .from(schema.appearances)
    )
      .filter((r) => r.name != null)
      .map((r) => ({ value: r.name!, label: r.name! })),
};

const tenantNameContext = {
  query: async (db: DB) =>
    (
      await db.select({ name: schema.tenants.name }).from(schema.tenants)
    )
      .filter((r) => r.name != null)
      .map((r) => ({ value: r.name!, label: r.name! })),
};

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const queryCatalog: CatalogQuery[] = [
  // ═══ Existing queries ═══

  // Список всех компонентов дизайн-системы по имени
  {
    id: "ds-components-by-name",
    label: "Список всех компонентов дизайн-системы по имени",
    type: "get",
    params: [
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const dsName = params?.designSystemName as string;

      return db
        .select({
          componentId: schema.components.id,
          componentName: schema.components.name,
          componentDescription: schema.components.description,
        })
        .from(schema.designSystemComponents)
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemComponents.designSystemId,
            schema.designSystems.id,
          ),
        )
        .innerJoin(
          schema.components,
          eq(schema.designSystemComponents.componentId, schema.components.id),
        )
        .where(eq(schema.designSystems.name, dsName));
    },
  },

  // Список всех дизайн-систем
  {
    id: "all-design-systems",
    label: "Список всех дизайн-систем",
    type: "get",
    run: async (db) => {
      return db
        .select({
          id: schema.designSystems.id,
          name: schema.designSystems.name,
          projectName: schema.designSystems.projectName,
          description: schema.designSystems.description,
          createdAt: schema.designSystems.createdAt,
          updatedAt: schema.designSystems.updatedAt,
        })
        .from(schema.designSystems);
    },
  },

  // Список всех пользователей и соответствующие им дизайн-системы
  {
    id: "users-with-design-systems",
    label: "Список всех пользователей и соответствующие им дизайн-системы",
    type: "get",
    run: async (db) => {
      return db
        .select({
          userId: schema.users.id,
          login: schema.users.login,
          designSystemId: schema.designSystems.id,
          designSystemName: schema.designSystems.name,
          projectName: schema.designSystems.projectName,
        })
        .from(schema.designSystemUsers)
        .innerJoin(
          schema.users,
          eq(schema.designSystemUsers.userId, schema.users.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(schema.designSystemUsers.designSystemId, schema.designSystems.id),
        );
    },
  },

  // ═══ 1. Список тенантов у выбранной дизайн системы ═══

  {
    id: "tenants-by-design-system",
    label: "Список тенантов у выбранной дизайн системы",
    type: "get",
    params: [
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const dsName = params?.designSystemName as string;

      return db
        .select({
          tenantId: schema.tenants.id,
          tenantName: schema.tenants.name,
          description: schema.tenants.description,
          colorConfig: schema.tenants.colorConfig,
        })
        .from(schema.tenants)
        .innerJoin(
          schema.designSystems,
          eq(schema.tenants.designSystemId, schema.designSystems.id),
        )
        .where(eq(schema.designSystems.name, dsName));
    },
  },

  // ═══ 2. Список токенов у компонента в выбранной ДС, тенанте и отображении ═══

  {
    id: "component-tokens-by-ds-tenant-appearance",
    label:
      "Список токенов у компонента в выбранной дизайн системе, тенанте и отображении",
    type: "get",
    params: [
      {
        name: "componentName",
        type: "string",
        default: "Button",
        context: componentNameContext,
      },
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
      {
        name: "tenantName",
        type: "string",
        default: "sdds_cs",
        context: tenantNameContext,
      },
      {
        name: "appearanceName",
        type: "string",
        default: "default",
        context: appearanceNameContext,
      },
    ],
    run: async (db, params) => {
      const componentName = params?.componentName as string;
      const dsName = params?.designSystemName as string;
      const tenantName = params?.tenantName as string;
      const appearanceName = params?.appearanceName as string;

      return db
        .select({
          tokenId: schema.tokens.id,
          tokenName: schema.tokens.name,
          tokenType: schema.tokens.type,
          displayName: schema.tokens.displayName,
          description: schema.tokens.description,
          enabled: schema.tokens.enabled,
          mode: schema.tokenValues.mode,
          platformValues:
            sql<Record<string, any>>`json_object_agg(${schema.tokenValues.platform}, ${schema.tokenValues.value})`,
        })
        .from(schema.variationPropertyValues)
        .innerJoin(
          schema.properties,
          eq(schema.variationPropertyValues.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .innerJoin(
          schema.appearances,
          eq(
            schema.variationPropertyValues.appearanceId,
            schema.appearances.id,
          ),
        )
        .innerJoin(
          schema.designSystems,
          eq(schema.appearances.designSystemId, schema.designSystems.id),
        )
        .innerJoin(
          schema.tokens,
          eq(schema.variationPropertyValues.tokenId, schema.tokens.id),
        )
        .innerJoin(
          schema.tokenValues,
          eq(schema.tokenValues.tokenId, schema.tokens.id),
        )
        .innerJoin(
          schema.tenants,
          and(
            eq(schema.tokenValues.tenantId, schema.tenants.id),
            eq(schema.tenants.designSystemId, schema.designSystems.id),
          ),
        )
        .where(
          and(
            eq(schema.components.name, componentName),
            eq(schema.designSystems.name, dsName),
            eq(schema.appearances.name, appearanceName),
            eq(schema.tenants.name, tenantName),
            isNotNull(schema.variationPropertyValues.tokenId),
          ),
        )
        .groupBy(
          schema.tokens.id,
          schema.tokens.name,
          schema.tokens.type,
          schema.tokens.displayName,
          schema.tokens.description,
          schema.tokens.enabled,
          schema.tokenValues.mode,
        );
    },
  },

  // ═══ 3. Список пропсов у выбранного компонента ═══

  {
    id: "component-properties",
    label: "Список пропсов у выбранного компонента",
    type: "get",
    params: [
      {
        name: "componentName",
        type: "string",
        default: "Button",
        context: componentNameContext,
      },
    ],
    run: async (db, params) => {
      const componentName = params?.componentName as string;

      return db
        .select({
          propertyId: schema.properties.id,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          defaultValue: schema.properties.defaultValue,
          description: schema.properties.description,
          componentName: schema.components.name,
        })
        .from(schema.properties)
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .where(eq(schema.components.name, componentName));
    },
  },

  // ═══ 4. Список пропсов у всех компонент в выбранной ДС и отображении ═══

  {
    id: "all-properties-by-ds-appearance",
    label:
      "Список пропсов у всех компонент в выбранной дизайн системе и отображении",
    type: "get",
    params: [
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
      {
        name: "appearanceName",
        type: "string",
        default: "default",
        context: appearanceNameContext,
      },
    ],
    run: async (db, params) => {
      const dsName = params?.designSystemName as string;
      const appearanceName = params?.appearanceName as string;

      return db
        .select({
          componentName: schema.components.name,
          propertyId: schema.properties.id,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          defaultValue: schema.properties.defaultValue,
          description: schema.properties.description,
        })
        .from(schema.properties)
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .innerJoin(
          schema.designSystemComponents,
          eq(
            schema.designSystemComponents.componentId,
            schema.components.id,
          ),
        )
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemComponents.designSystemId,
            schema.designSystems.id,
          ),
        )
        .innerJoin(
          schema.appearances,
          and(
            eq(schema.appearances.componentId, schema.components.id),
            eq(schema.appearances.designSystemId, schema.designSystems.id),
          ),
        )
        .where(
          and(
            eq(schema.designSystems.name, dsName),
            eq(schema.appearances.name, appearanceName),
          ),
        );
    },
  },

  // ═══ 6. Список всей документации ═══

  {
    id: "all-documentation",
    label: "Список всей документации",
    type: "get",
    run: async (db) => {
      return db
        .select({
          documentId: schema.documentationPages.id,
          designSystemName: schema.designSystems.name,
          content: schema.documentationPages.content,
          createdAt: schema.documentationPages.createdAt,
          updatedAt: schema.documentationPages.updatedAt,
        })
        .from(schema.documentationPages)
        .innerJoin(
          schema.designSystems,
          eq(
            schema.documentationPages.designSystemId,
            schema.designSystems.id,
          ),
        );
    },
  },

  // ═══ 8. Список инвариантных пропсов для всех компонент ═══

  {
    id: "invariant-properties",
    label: "Список инвариантных пропсов для всех компонент",
    type: "get",
    run: async (db) => {
      return db
        .select({
          componentName: schema.components.name,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          value: schema.invariantPropertyValues.value,
          state: schema.invariantPropertyValues.state,
          designSystemName: schema.designSystems.name,
          appearanceName: schema.appearances.name,
        })
        .from(schema.invariantPropertyValues)
        .innerJoin(
          schema.properties,
          eq(schema.invariantPropertyValues.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(
            schema.invariantPropertyValues.componentId,
            schema.components.id,
          ),
        )
        .innerJoin(
          schema.designSystems,
          eq(
            schema.invariantPropertyValues.designSystemId,
            schema.designSystems.id,
          ),
        )
        .innerJoin(
          schema.appearances,
          eq(
            schema.invariantPropertyValues.appearanceId,
            schema.appearances.id,
          ),
        );
    },
  },

  // ═══ 9. Список пропсов с пересечением для всех компонент ═══

  {
    id: "style-combination-properties",
    label: "Список пропсов с пересечением для всех компонент",
    type: "get",
    run: async (db) => {
      return db
        .select({
          componentName: schema.components.name,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          combinationValue: schema.styleCombinations.value,
          appearanceName: schema.appearances.name,
          memberStyleName: schema.styles.name,
        })
        .from(schema.styleCombinations)
        .innerJoin(
          schema.styleCombinationMembers,
          eq(
            schema.styleCombinationMembers.combinationId,
            schema.styleCombinations.id,
          ),
        )
        .innerJoin(
          schema.styles,
          eq(schema.styleCombinationMembers.styleId, schema.styles.id),
        )
        .innerJoin(
          schema.properties,
          eq(schema.styleCombinations.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .innerJoin(
          schema.appearances,
          eq(schema.styleCombinations.appearanceId, schema.appearances.id),
        );
    },
  },

  // ═══ 10. Компоненты со связями по типу (reuse / compose) ═══

  {
    id: "component-deps",
    label: "Компоненты, имеющие связи выбранного типа",
    type: "get",
    params: [
      {
        name: "relationType",
        type: "string",
        default: "compose",
        context: {
          query: async () => [
            { value: "compose", label: "compose" },
            { value: "reuse", label: "reuse" },
          ],
        },
      },
    ],
    run: async (db, params) => {
      const relationType = params?.relationType as "reuse" | "compose";

      const parent = alias(schema.components, "parent");
      const child = alias(schema.components, "child");

      return db
        .select({
          parentName: parent.name,
          childName: child.name,
          type: schema.componentDeps.type,
          order: schema.componentDeps.order,
        })
        .from(schema.componentDeps)
        .innerJoin(
          parent,
          eq(schema.componentDeps.parentId, parent.id),
        )
        .innerJoin(
          child,
          eq(schema.componentDeps.childId, child.id),
        )
        .where(eq(schema.componentDeps.type, relationType));
    },
  },

  // ═══ 11. Список доступных отображений для компонента в ДС ═══

  {
    id: "component-appearances",
    label:
      "Список доступных отображений для выбранного компонента в выбранной дизайн системе",
    type: "get",
    params: [
      {
        name: "componentName",
        type: "string",
        default: "Button",
        context: componentNameContext,
      },
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const componentName = params?.componentName as string;
      const dsName = params?.designSystemName as string;

      return db
        .select({
          appearanceId: schema.appearances.id,
          appearanceName: schema.appearances.name,
        })
        .from(schema.appearances)
        .innerJoin(
          schema.components,
          eq(schema.appearances.componentId, schema.components.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(schema.appearances.designSystemId, schema.designSystems.id),
        )
        .where(
          and(
            eq(schema.components.name, componentName),
            eq(schema.designSystems.name, dsName),
          ),
        );
    },
  },

  // ═══ 12. Список токенов темы по выбранному типу ═══

  {
    id: "tokens-by-type",
    label: "Список токенов темы по выбранному типу",
    type: "get",
    params: [
      {
        name: "tokenType",
        type: "string",
        default: "color",
        context: {
          query: async () =>
            [
              "color",
              "gradient",
              "typography",
              "fontFamily",
              "spacing",
              "shape",
              "shadow",
            ].map((t) => ({ value: t, label: t })),
        },
      },
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const tokenType = params?.tokenType as string;
      const dsName = params?.designSystemName as string;

      return db
        .select({
          tokenId: schema.tokens.id,
          name: schema.tokens.name,
          type: schema.tokens.type,
          displayName: schema.tokens.displayName,
          description: schema.tokens.description,
          enabled: schema.tokens.enabled,
        })
        .from(schema.tokens)
        .innerJoin(
          schema.designSystems,
          eq(schema.tokens.designSystemId, schema.designSystems.id),
        )
        .where(
          and(
            sql`${schema.tokens.type} = ${tokenType}`,
            eq(schema.designSystems.name, dsName),
          ),
        );
    },
  },

  // ═══ 13. Список пропсов компонент по выбранному типу ═══

  {
    id: "properties-by-type",
    label: "Список пропсов компонент по выбранному типу",
    type: "get",
    params: [
      {
        name: "propertyType",
        type: "string",
        default: "color",
        context: {
          query: async () =>
            ["color", "typography", "shape", "shadow", "dimension", "float"].map(
              (t) => ({ value: t, label: t }),
            ),
        },
      },
    ],
    run: async (db, params) => {
      const propertyType = params?.propertyType as string;

      return db
        .select({
          propertyId: schema.properties.id,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          defaultValue: schema.properties.defaultValue,
          description: schema.properties.description,
          componentName: schema.components.name,
        })
        .from(schema.properties)
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .where(sql`${schema.properties.type} = ${propertyType}`);
    },
  },

  // ═══ 14. Список тенантов по выбранному акцентному цвету ═══

  {
    id: "tenants-by-accent-color",
    label: "Список тенантов по выбранному акцентному цвету",
    type: "get",
    params: [
      {
        name: "accentColor",
        type: "string",
        default: "green",
        context: {
          query: async (db) => {
            const rows = await db.execute(
              sql`SELECT DISTINCT color_config->>'accentColor' AS accent FROM tenants WHERE color_config->>'accentColor' IS NOT NULL`,
            );
            return [...rows].map((r: any) => ({
              value: r.accent,
              label: r.accent,
            }));
          },
        },
      },
    ],
    run: async (db, params) => {
      const accentColor = params?.accentColor as string;

      return db
        .select({
          tenantId: schema.tenants.id,
          tenantName: schema.tenants.name,
          description: schema.tenants.description,
          colorConfig: schema.tenants.colorConfig,
          designSystemName: schema.designSystems.name,
        })
        .from(schema.tenants)
        .innerJoin(
          schema.designSystems,
          eq(schema.tenants.designSystemId, schema.designSystems.id),
        )
        .where(
          sql`${schema.tenants.colorConfig}->>'accentColor' = ${accentColor}`,
        );
    },
  },

  // ═══ 15. Список значений токенов для выбранной платформы ═══

  {
    id: "token-values-by-platform",
    label: "Список значений токенов только для выбранной платформы",
    type: "get",
    params: [
      {
        name: "platform",
        type: "string",
        default: "web",
        context: {
          query: async () =>
            ["web", "android", "ios"].map((p) => ({ value: p, label: p })),
        },
      },
    ],
    run: async (db, params) => {
      const platform = params?.platform as string;

      return db
        .select({
          tokenValueId: schema.tokenValues.id,
          tokenName: schema.tokens.name,
          tokenType: schema.tokens.type,
          platform: schema.tokenValues.platform,
          mode: schema.tokenValues.mode,
          value: schema.tokenValues.value,
          paletteId: schema.tokenValues.paletteId,
          tenantName: schema.tenants.name,
          designSystemName: schema.designSystems.name,
        })
        .from(schema.tokenValues)
        .innerJoin(
          schema.tokens,
          eq(schema.tokenValues.tokenId, schema.tokens.id),
        )
        .innerJoin(
          schema.tenants,
          eq(schema.tokenValues.tenantId, schema.tenants.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(schema.tokens.designSystemId, schema.designSystems.id),
        )
        .where(sql`${schema.tokenValues.platform} = ${platform}`);
    },
  },

  // ═══ 16. Список всех пропсов со стейтами ═══

  {
    id: "properties-with-states",
    label: "Список всех пропсов со стейтами",
    type: "get",
    run: async (db) => {
      const variationProps = await db
        .select({
          componentName: schema.components.name,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          state: schema.variationPropertyValues.state,
          value: schema.variationPropertyValues.value,
          tokenId: schema.variationPropertyValues.tokenId,
          styleName: schema.styles.name,
          appearanceName: schema.appearances.name,
        })
        .from(schema.variationPropertyValues)
        .innerJoin(
          schema.properties,
          eq(schema.variationPropertyValues.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .innerJoin(
          schema.styles,
          eq(schema.variationPropertyValues.styleId, schema.styles.id),
        )
        .innerJoin(
          schema.appearances,
          eq(
            schema.variationPropertyValues.appearanceId,
            schema.appearances.id,
          ),
        )
        .where(isNotNull(schema.variationPropertyValues.state));

      const invariantProps = await db
        .select({
          componentName: schema.components.name,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          state: schema.invariantPropertyValues.state,
          value: schema.invariantPropertyValues.value,
          tokenId: schema.invariantPropertyValues.tokenId,
          styleName: sql<string>`null`,
          appearanceName: schema.appearances.name,
        })
        .from(schema.invariantPropertyValues)
        .innerJoin(
          schema.properties,
          eq(schema.invariantPropertyValues.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(
            schema.invariantPropertyValues.componentId,
            schema.components.id,
          ),
        )
        .innerJoin(
          schema.appearances,
          eq(
            schema.invariantPropertyValues.appearanceId,
            schema.appearances.id,
          ),
        )
        .where(isNotNull(schema.invariantPropertyValues.state));

      return [...variationProps, ...invariantProps];
    },
  },

  // ═══ 17. Список дефолтных стилей для всех компонент в ДС и отображении ═══

  {
    id: "default-styles-by-ds-appearance",
    label:
      "Список дефолтных стилей для всех компонент в выбранной дизайн системе и отображении",
    type: "get",
    params: [
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
      {
        name: "appearanceName",
        type: "string",
        default: "default",
        context: appearanceNameContext,
      },
    ],
    run: async (db, params) => {
      const dsName = params?.designSystemName as string;
      const appearanceName = params?.appearanceName as string;

      return db
        .selectDistinct({
          componentName: schema.components.name,
          variationName: schema.variations.name,
          styleName: schema.styles.name,
          styleDescription: schema.styles.description,
        })
        .from(schema.styles)
        .innerJoin(
          schema.variations,
          eq(schema.styles.variationId, schema.variations.id),
        )
        .innerJoin(
          schema.components,
          eq(schema.variations.componentId, schema.components.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(schema.styles.designSystemId, schema.designSystems.id),
        )
        .innerJoin(
          schema.appearances,
          and(
            eq(schema.appearances.componentId, schema.components.id),
            eq(schema.appearances.designSystemId, schema.designSystems.id),
          ),
        )
        .where(
          and(
            eq(schema.styles.isDefault, true),
            eq(schema.designSystems.name, dsName),
            eq(schema.appearances.name, appearanceName),
          ),
        );
    },
  },

  // ═══ 18. Список ссылочных значений пропсов у выбранного компонента ═══

  {
    id: "token-reference-values-by-component",
    label: "Список ссылочных значений пропсов у выбранного компонента",
    type: "get",
    params: [
      {
        name: "componentName",
        type: "string",
        default: "Button",
        context: componentNameContext,
      },
    ],
    run: async (db, params) => {
      const componentName = params?.componentName as string;

      return db
        .select({
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          tokenName: schema.tokens.name,
          tokenType: schema.tokens.type,
          styleName: schema.styles.name,
          appearanceName: schema.appearances.name,
          state: schema.variationPropertyValues.state,
        })
        .from(schema.variationPropertyValues)
        .innerJoin(
          schema.properties,
          eq(schema.variationPropertyValues.propertyId, schema.properties.id),
        )
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .innerJoin(
          schema.tokens,
          eq(schema.variationPropertyValues.tokenId, schema.tokens.id),
        )
        .innerJoin(
          schema.styles,
          eq(schema.variationPropertyValues.styleId, schema.styles.id),
        )
        .innerJoin(
          schema.appearances,
          eq(
            schema.variationPropertyValues.appearanceId,
            schema.appearances.id,
          ),
        )
        .where(
          and(
            eq(schema.components.name, componentName),
            isNotNull(schema.variationPropertyValues.tokenId),
          ),
        );
    },
  },

  // ═══ 19. Список опубликованных версий по выбранному статусу ═══

  {
    id: "versions-by-publication-status",
    label: "Список опубликованных версий по выбранному статусу",
    type: "get",
    params: [
      {
        name: "publicationStatus",
        type: "string",
        default: "published",
        context: {
          query: async () =>
            ["publishing", "published", "failed"].map((s) => ({
              value: s,
              label: s,
            })),
        },
      },
    ],
    run: async (db, params) => {
      const status = params?.publicationStatus as string;

      return db
        .select({
          versionId: schema.designSystemVersions.id,
          version: schema.designSystemVersions.version,
          publicationStatus: schema.designSystemVersions.publicationStatus,
          publishedAt: schema.designSystemVersions.publishedAt,
          changelog: schema.designSystemVersions.changelog,
          designSystemName: schema.designSystems.name,
          userName: schema.users.login,
        })
        .from(schema.designSystemVersions)
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemVersions.designSystemId,
            schema.designSystems.id,
          ),
        )
        .leftJoin(
          schema.users,
          eq(schema.designSystemVersions.userId, schema.users.id),
        )
        .where(
          sql`${schema.designSystemVersions.publicationStatus} = ${status}`,
        );
    },
  },

  // ═══ 20. Список всех изменений сделанных выбранным пользователем ═══

  {
    id: "user-entity-changes",
    label: "Список всех изменений сделанных выбранным пользователем",
    type: "get",
    params: [
      {
        name: "userLogin",
        type: "string",
        default: "neretin",
        context: userLoginContext,
      },
    ],
    run: async (db, params) => {
      const userLogin = params?.userLogin as string;

      return db
        .select({
          changeId: schema.designSystemChanges.id,
          entityType: schema.designSystemChanges.entityType,
          entityId: schema.designSystemChanges.entityId,
          operation: schema.designSystemChanges.operation,
          data: schema.designSystemChanges.data,
          designSystemName: schema.designSystems.name,
          createdAt: schema.designSystemChanges.createdAt,
        })
        .from(schema.designSystemChanges)
        .innerJoin(
          schema.users,
          eq(schema.designSystemChanges.userId, schema.users.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemChanges.designSystemId,
            schema.designSystems.id,
          ),
        )
        .where(eq(schema.users.login, userLogin));
    },
  },

  // ═══ 21. Список сущностей в выбранной ДС и версии (из snapshot) ═══

  {
    id: "entities-by-ds-version",
    label: "Список сущностей в выбранной дизайн системе и версии",
    type: "get",
    params: [
      {
        name: "versionId",
        type: "string",
        context: {
          query: async (db: DB) =>
            (
              await db
                .select({
                  id: schema.designSystemVersions.id,
                  version: schema.designSystemVersions.version,
                  dsName: schema.designSystems.name,
                })
                .from(schema.designSystemVersions)
                .innerJoin(
                  schema.designSystems,
                  eq(
                    schema.designSystemVersions.designSystemId,
                    schema.designSystems.id,
                  ),
                )
            ).map((r) => ({
              value: r.id,
              label: `${r.dsName} — ${r.version}`,
            })),
        },
      },
    ],
    run: async (db, params) => {
      const versionId = params?.versionId as string;
      if (!versionId) return [];

      const [row] = await db
        .select({
          version: schema.designSystemVersions.version,
          snapshot: schema.designSystemVersions.snapshot,
          designSystemName: schema.designSystems.name,
        })
        .from(schema.designSystemVersions)
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemVersions.designSystemId,
            schema.designSystems.id,
          ),
        )
        .where(eq(schema.designSystemVersions.id, versionId));

      if (!row) return [];

      const snap = row.snapshot as Record<string, any>;
      const result: {
        entityType: string;
        entityName: string;
        extra: string | null;
      }[] = [];

      for (const comp of snap.components ?? []) {
        result.push({
          entityType: "component",
          entityName: comp.name,
          extra: null,
        });
        for (const variation of comp.variations ?? []) {
          result.push({
            entityType: "variation",
            entityName: variation.name,
            extra: comp.name,
          });
          for (const style of variation.styles ?? []) {
            result.push({
              entityType: "style",
              entityName: typeof style === "string" ? style : style.name,
              extra: `${comp.name} / ${variation.name}`,
            });
          }
        }
      }
      for (const token of snap.tokens ?? []) {
        result.push({
          entityType: "token",
          entityName: token.name,
          extra: token.type ?? null,
        });
      }
      for (const appearance of snap.appearances ?? []) {
        result.push({
          entityType: "appearance",
          entityName: appearance.name,
          extra: null,
        });
      }
      for (const tenant of snap.tenants ?? []) {
        result.push({
          entityType: "tenant",
          entityName: tenant.name,
          extra: null,
        });
      }

      return result;
    },
  },

  // ═══ 22. Мёрдж актуальных данных с черновиком (draft) ═══

  {
    id: "merged-actual-with-draft",
    label:
      "Мёрдж актуальных данных с черновиком (draft) для выбранной дизайн-системы",
    type: "get",
    params: [
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
      {
        name: "entityType",
        type: "string",
        default: "token",
        context: {
          query: async () =>
            [
              "token",
              "style",
              "token_value",
              "variation_property_value",
              "invariant_property_value",
              "appearance",
              "variation",
              "tenant",
              "property",
              "design_system_component",
              "design_system_user",
              "property_variation",
              "style_combination",
              "documentation_page",
              "style_combination_member",
            ].map((t) => ({ value: t, label: t })),
        },
      },
    ],
    run: async (db, params) => {
      const dsName = params?.designSystemName as string;
      const entityType = params?.entityType as string;

      // 1. Resolve design system
      const [ds] = await db
        .select({ id: schema.designSystems.id })
        .from(schema.designSystems)
        .where(eq(schema.designSystems.name, dsName));
      if (!ds) return [];

      // 2. Fetch unpublished draft changes (after the last published version)
      const draftChanges = await db
        .select({
          entityId: schema.designSystemChanges.entityId,
          operation: schema.designSystemChanges.operation,
          data: schema.designSystemChanges.data,
        })
        .from(schema.designSystemChanges)
        .where(
          and(
            eq(schema.designSystemChanges.designSystemId, ds.id),
            eq(schema.designSystemChanges.entityType, entityType),
            sql`${schema.designSystemChanges.createdAt} > coalesce(
              (SELECT max(published_at) FROM design_system_versions
               WHERE design_system_id = ${ds.id}
               AND publication_status = 'published'),
              '1970-01-01'::timestamp
            )`,
          ),
        );

      // 3. Fetch actual rows from the corresponding table
      let actualRows: Record<string, any>[] = [];

      switch (entityType) {
        case "token":
          actualRows = await db
            .select({
              id: schema.tokens.id,
              name: schema.tokens.name,
              type: schema.tokens.type,
              displayName: schema.tokens.displayName,
              description: schema.tokens.description,
              enabled: schema.tokens.enabled,
            })
            .from(schema.tokens)
            .where(eq(schema.tokens.designSystemId, ds.id));
          break;

        case "style":
          actualRows = await db
            .select({
              id: schema.styles.id,
              variationId: schema.styles.variationId,
              name: schema.styles.name,
              description: schema.styles.description,
              isDefault: schema.styles.isDefault,
              variationName: schema.variations.name,
              componentName: schema.components.name,
            })
            .from(schema.styles)
            .innerJoin(
              schema.variations,
              eq(schema.styles.variationId, schema.variations.id),
            )
            .innerJoin(
              schema.components,
              eq(schema.variations.componentId, schema.components.id),
            )
            .where(eq(schema.styles.designSystemId, ds.id));
          break;

        case "token_value":
          actualRows = await db
            .select({
              id: schema.tokenValues.id,
              tokenId: schema.tokenValues.tokenId,
              tenantId: schema.tokenValues.tenantId,
              platform: schema.tokenValues.platform,
              mode: schema.tokenValues.mode,
              value: schema.tokenValues.value,
              tokenName: schema.tokens.name,
              tenantName: schema.tenants.name,
            })
            .from(schema.tokenValues)
            .innerJoin(
              schema.tokens,
              eq(schema.tokenValues.tokenId, schema.tokens.id),
            )
            .innerJoin(
              schema.tenants,
              eq(schema.tokenValues.tenantId, schema.tenants.id),
            )
            .where(eq(schema.tokens.designSystemId, ds.id));
          break;

        case "variation_property_value":
          actualRows = await db
            .select({
              id: schema.variationPropertyValues.id,
              propertyId: schema.variationPropertyValues.propertyId,
              styleId: schema.variationPropertyValues.styleId,
              appearanceId: schema.variationPropertyValues.appearanceId,
              tokenId: schema.variationPropertyValues.tokenId,
              value: schema.variationPropertyValues.value,
              state: schema.variationPropertyValues.state,
              propertyName: schema.properties.name,
              styleName: schema.styles.name,
              appearanceName: schema.appearances.name,
            })
            .from(schema.variationPropertyValues)
            .innerJoin(
              schema.properties,
              eq(
                schema.variationPropertyValues.propertyId,
                schema.properties.id,
              ),
            )
            .innerJoin(
              schema.styles,
              eq(schema.variationPropertyValues.styleId, schema.styles.id),
            )
            .innerJoin(
              schema.appearances,
              eq(
                schema.variationPropertyValues.appearanceId,
                schema.appearances.id,
              ),
            )
            .where(eq(schema.styles.designSystemId, ds.id));
          break;

        case "invariant_property_value":
          actualRows = await db
            .select({
              id: schema.invariantPropertyValues.id,
              propertyId: schema.invariantPropertyValues.propertyId,
              designSystemId: schema.invariantPropertyValues.designSystemId,
              componentId: schema.invariantPropertyValues.componentId,
              appearanceId: schema.invariantPropertyValues.appearanceId,
              tokenId: schema.invariantPropertyValues.tokenId,
              value: schema.invariantPropertyValues.value,
              state: schema.invariantPropertyValues.state,
              propertyName: schema.properties.name,
              componentName: schema.components.name,
              appearanceName: schema.appearances.name,
            })
            .from(schema.invariantPropertyValues)
            .innerJoin(
              schema.properties,
              eq(
                schema.invariantPropertyValues.propertyId,
                schema.properties.id,
              ),
            )
            .innerJoin(
              schema.components,
              eq(
                schema.invariantPropertyValues.componentId,
                schema.components.id,
              ),
            )
            .innerJoin(
              schema.appearances,
              eq(
                schema.invariantPropertyValues.appearanceId,
                schema.appearances.id,
              ),
            )
            .where(
              eq(schema.invariantPropertyValues.designSystemId, ds.id),
            );
          break;

        case "appearance":
          actualRows = await db
            .select({
              id: schema.appearances.id,
              designSystemId: schema.appearances.designSystemId,
              componentId: schema.appearances.componentId,
              name: schema.appearances.name,
              componentName: schema.components.name,
            })
            .from(schema.appearances)
            .innerJoin(
              schema.components,
              eq(schema.appearances.componentId, schema.components.id),
            )
            .where(eq(schema.appearances.designSystemId, ds.id));
          break;

        case "variation":
          actualRows = await db
            .select({
              id: schema.variations.id,
              componentId: schema.variations.componentId,
              name: schema.variations.name,
              description: schema.variations.description,
              componentName: schema.components.name,
            })
            .from(schema.variations)
            .innerJoin(
              schema.components,
              eq(schema.variations.componentId, schema.components.id),
            )
            .innerJoin(
              schema.designSystemComponents,
              eq(
                schema.designSystemComponents.componentId,
                schema.components.id,
              ),
            )
            .where(
              eq(schema.designSystemComponents.designSystemId, ds.id),
            );
          break;

        case "tenant":
          actualRows = await db
            .select({
              id: schema.tenants.id,
              designSystemId: schema.tenants.designSystemId,
              name: schema.tenants.name,
              description: schema.tenants.description,
              colorConfig: schema.tenants.colorConfig,
            })
            .from(schema.tenants)
            .where(eq(schema.tenants.designSystemId, ds.id));
          break;

        case "property":
          actualRows = await db
            .select({
              id: schema.properties.id,
              componentId: schema.properties.componentId,
              name: schema.properties.name,
              type: schema.properties.type,
              defaultValue: schema.properties.defaultValue,
              description: schema.properties.description,
              componentName: schema.components.name,
            })
            .from(schema.properties)
            .innerJoin(
              schema.components,
              eq(schema.properties.componentId, schema.components.id),
            )
            .innerJoin(
              schema.designSystemComponents,
              eq(
                schema.designSystemComponents.componentId,
                schema.components.id,
              ),
            )
            .where(
              eq(schema.designSystemComponents.designSystemId, ds.id),
            );
          break;

        case "design_system_component":
          actualRows = await db
            .select({
              id: schema.designSystemComponents.id,
              designSystemId: schema.designSystemComponents.designSystemId,
              componentId: schema.designSystemComponents.componentId,
              componentName: schema.components.name,
            })
            .from(schema.designSystemComponents)
            .innerJoin(
              schema.components,
              eq(
                schema.designSystemComponents.componentId,
                schema.components.id,
              ),
            )
            .where(
              eq(schema.designSystemComponents.designSystemId, ds.id),
            );
          break;

        case "design_system_user":
          actualRows = await db
            .select({
              id: schema.designSystemUsers.id,
              designSystemId: schema.designSystemUsers.designSystemId,
              userId: schema.designSystemUsers.userId,
              userLogin: schema.users.login,
            })
            .from(schema.designSystemUsers)
            .innerJoin(
              schema.users,
              eq(schema.designSystemUsers.userId, schema.users.id),
            )
            .where(
              eq(schema.designSystemUsers.designSystemId, ds.id),
            );
          break;

        case "property_variation":
          actualRows = await db
            .select({
              id: schema.propertyVariations.id,
              propertyId: schema.propertyVariations.propertyId,
              variationId: schema.propertyVariations.variationId,
              propertyName: schema.properties.name,
              variationName: schema.variations.name,
            })
            .from(schema.propertyVariations)
            .innerJoin(
              schema.properties,
              eq(
                schema.propertyVariations.propertyId,
                schema.properties.id,
              ),
            )
            .innerJoin(
              schema.variations,
              eq(
                schema.propertyVariations.variationId,
                schema.variations.id,
              ),
            )
            .innerJoin(
              schema.components,
              eq(schema.properties.componentId, schema.components.id),
            )
            .innerJoin(
              schema.designSystemComponents,
              eq(
                schema.designSystemComponents.componentId,
                schema.components.id,
              ),
            )
            .where(
              eq(schema.designSystemComponents.designSystemId, ds.id),
            );
          break;

        case "style_combination":
          actualRows = await db
            .select({
              id: schema.styleCombinations.id,
              propertyId: schema.styleCombinations.propertyId,
              appearanceId: schema.styleCombinations.appearanceId,
              value: schema.styleCombinations.value,
              states: schema.styleCombinations.states,
              propertyName: schema.properties.name,
              appearanceName: schema.appearances.name,
              componentName: schema.components.name,
            })
            .from(schema.styleCombinations)
            .innerJoin(
              schema.properties,
              eq(
                schema.styleCombinations.propertyId,
                schema.properties.id,
              ),
            )
            .innerJoin(
              schema.appearances,
              eq(
                schema.styleCombinations.appearanceId,
                schema.appearances.id,
              ),
            )
            .innerJoin(
              schema.components,
              eq(schema.appearances.componentId, schema.components.id),
            )
            .where(eq(schema.appearances.designSystemId, ds.id));
          break;

        case "documentation_page":
          actualRows = await db
            .select({
              id: schema.documentationPages.id,
              designSystemId: schema.documentationPages.designSystemId,
              content: schema.documentationPages.content,
            })
            .from(schema.documentationPages)
            .where(eq(schema.documentationPages.designSystemId, ds.id));
          break;

        case "style_combination_member":
          actualRows = await db
            .select({
              id: schema.styleCombinationMembers.id,
              combinationId: schema.styleCombinationMembers.combinationId,
              styleId: schema.styleCombinationMembers.styleId,
              styleName: schema.styles.name,
              combinationValue: schema.styleCombinations.value,
            })
            .from(schema.styleCombinationMembers)
            .innerJoin(
              schema.styles,
              eq(
                schema.styleCombinationMembers.styleId,
                schema.styles.id,
              ),
            )
            .innerJoin(
              schema.styleCombinations,
              eq(
                schema.styleCombinationMembers.combinationId,
                schema.styleCombinations.id,
              ),
            )
            .where(eq(schema.styles.designSystemId, ds.id));
          break;

        default:
          return [];
      }

      // 4. Classify draft changes
      const deletes = draftChanges.filter((c) => c.operation === "deleted");
      const updates = draftChanges.filter((c) => c.operation === "updated");
      const creates = draftChanges.filter((c) => c.operation === "created");

      // entityId в design_system_changes ссылается на разные ключи в зависимости от entityType:
      //   token_value              → row.tokenId    (entityId = tokenId)
      //   variation_property_value → row.styleId    (entityId = styleId)
      //   property_variation       → row.propertyId (entityId = propertyId)
      //   остальные                → row.id
      const getRowKey = (row: Record<string, any>): string => {
        switch (entityType) {
          case "token_value":
            return row.tokenId;
          case "variation_property_value":
            return row.styleId;
          case "property_variation":
            return row.propertyId;
          default:
            return row.id;
        }
      };

      // Для update нужно точное совпадение по составному ключу (для таблиц-связок)
      const isUpdateMatch = (
        row: Record<string, any>,
        data: Record<string, any>,
      ): boolean => {
        switch (entityType) {
          case "token_value":
            return (
              row.tokenId === data.tokenId &&
              row.tenantId === data.tenantId &&
              row.platform === data.platform
            );
          case "variation_property_value":
            return (
              row.styleId === data.styleId &&
              row.propertyId === data.propertyId &&
              row.appearanceId === data.appearanceId
            );
          case "invariant_property_value":
            return (
              row.propertyId === data.propertyId &&
              row.componentId === data.componentId &&
              row.appearanceId === data.appearanceId
            );
          case "property_variation":
            return (
              row.propertyId === data.propertyId &&
              row.variationId === data.variationId
            );
          case "style_combination_member":
            return (
              row.combinationId === data.combinationId &&
              row.styleId === data.styleId
            );
          default:
            return true; // entityId совпадение достаточно
        }
      };

      const deleteEntityIds = new Set(deletes.map((d) => d.entityId));

      // 5. Merge: actual + draft
      const result: Record<string, any>[] = [];

      for (const row of actualRows) {
        const rowKey = getRowKey(row);

        // Deleted in draft → помечаем
        if (deleteEntityIds.has(rowKey)) {
          result.push({ ...row, _status: "deleted" });
          continue;
        }

        // Updated in draft → накладываем data
        const updateChange = updates.find(
          (u) =>
            u.entityId === rowKey &&
            isUpdateMatch(row, u.data as Record<string, any>),
        );
        if (updateChange) {
          result.push({
            ...row,
            ...(updateChange.data as Record<string, any>),
            _status: "updated",
          });
          continue;
        }

        // Не затронут драфтом
        result.push({ ...row, _status: "actual" });
      }

      // Created in draft → добавляем
      for (const c of creates) {
        result.push({
          ...(c.data as Record<string, any>),
          _status: "created",
        });
      }

      return result;
    },
  },

  // ═══ 23. Все пропсы компонента с учётом reuse-зависимостей ═══

  {
    id: "component-properties-with-reuse",
    label:
      "Все пропсы компонента с учётом переиспользованных компонент (reuse)",
    type: "get",
    params: [
      {
        name: "componentName",
        type: "string",
        default: "TextField",
        context: componentNameContext,
      },
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const componentName = params?.componentName as string;
      const dsName = params?.designSystemName as string;

      // 1. Own properties
      const ownProps = await db
        .select({
          source: sql<string>`'own'`.as("source"),
          componentName: schema.components.name,
          propertyId: schema.properties.id,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          defaultValue: schema.properties.defaultValue,
          description: schema.properties.description,
          reuseAppearance: sql<string | null>`null`.as("reuse_appearance"),
          reuseVariation: sql<string | null>`null`.as("reuse_variation"),
          reuseStyle: sql<string | null>`null`.as("reuse_style"),
        })
        .from(schema.properties)
        .innerJoin(
          schema.components,
          eq(schema.properties.componentId, schema.components.id),
        )
        .where(eq(schema.components.name, componentName));

      // 2. Properties from reused children via component_reuse_configs
      const parent = alias(schema.components, "parent");
      const child = alias(schema.components, "child");
      const reuseAppearance = alias(schema.appearances, "reuse_appearance");
      const reuseVariation = alias(schema.variations, "reuse_variation");
      const reuseStyle = alias(schema.styles, "reuse_style");

      const reusedProps = await db
        .select({
          source: sql<string>`'reuse'`.as("source"),
          componentName: child.name,
          propertyId: schema.properties.id,
          propertyName: schema.properties.name,
          propertyType: schema.properties.type,
          defaultValue: schema.properties.defaultValue,
          description: schema.properties.description,
          reuseAppearance: reuseAppearance.name,
          reuseVariation: reuseVariation.name,
          reuseStyle: reuseStyle.name,
        })
        .from(schema.componentReuseConfigs)
        .innerJoin(
          schema.componentDeps,
          eq(
            schema.componentReuseConfigs.componentDepId,
            schema.componentDeps.id,
          ),
        )
        .innerJoin(parent, eq(schema.componentDeps.parentId, parent.id))
        .innerJoin(child, eq(schema.componentDeps.childId, child.id))
        .innerJoin(
          schema.designSystems,
          eq(
            schema.componentReuseConfigs.designSystemId,
            schema.designSystems.id,
          ),
        )
        .innerJoin(
          schema.properties,
          eq(schema.properties.componentId, child.id),
        )
        .innerJoin(
          reuseAppearance,
          eq(schema.componentReuseConfigs.appearanceId, reuseAppearance.id),
        )
        .innerJoin(
          reuseVariation,
          eq(schema.componentReuseConfigs.variationId, reuseVariation.id),
        )
        .innerJoin(
          reuseStyle,
          eq(schema.componentReuseConfigs.styleId, reuseStyle.id),
        )
        .where(
          and(
            eq(parent.name, componentName),
            eq(schema.designSystems.name, dsName),
            eq(schema.componentDeps.type, "reuse"),
          ),
        );

      return [...ownProps, ...reusedProps];
    },
  },

  // ═══ 24. Список неопубликованных изменений по выбранному пользователю ═══

  {
    id: "unpublished-changes-by-user",
    label: "Список неопубликованных изменений по выбранному пользователю",
    type: "get",
    params: [
      {
        name: "userLogin",
        type: "string",
        default: "neretin",
        context: userLoginContext,
      },
      {
        name: "designSystemName",
        type: "string",
        default: "SDDS",
        context: dsNameContext,
      },
    ],
    run: async (db, params) => {
      const userLogin = params?.userLogin as string;
      const dsName = params?.designSystemName as string;

      return db
        .select({
          entityType: schema.designSystemChanges.entityType,
          entityId: schema.designSystemChanges.entityId,
          operation: schema.designSystemChanges.operation,
          data: schema.designSystemChanges.data,
          createdAt: schema.designSystemChanges.createdAt,
        })
        .from(schema.designSystemChanges)
        .innerJoin(
          schema.users,
          eq(schema.designSystemChanges.userId, schema.users.id),
        )
        .innerJoin(
          schema.designSystems,
          eq(
            schema.designSystemChanges.designSystemId,
            schema.designSystems.id,
          ),
        )
        .where(
          and(
            eq(schema.users.login, userLogin),
            eq(schema.designSystems.name, dsName),
            sql`${schema.designSystemChanges.createdAt} > coalesce(
              (SELECT max(published_at) FROM design_system_versions
               WHERE design_system_id = ${schema.designSystemChanges.designSystemId}
               AND publication_status = 'published'),
              '1970-01-01'::timestamp
            )`,
          ),
        );
    },
  },

];
