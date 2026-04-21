import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";

const drizzleTables: PgTable[] = [];
for (const value of Object.values(schema)) {
  if (is(value, Table)) {
    drizzleTables.push(value as PgTable);
  }
}

function buildTableDescription(table: PgTable): string {
  const name = getTableName(table);
  const cols = getTableColumns(table);

  const columnLines = Object.entries(cols).map(([_key, col]) => {
    const parts: string[] = [`  - ${col.name}: ${col.dataType}`];
    if ((col as any).primaryKey) parts.push("(PK)");
    if (col.notNull) parts.push("(NOT NULL)");
    return parts.join(" ");
  });

  return `Table "${name}":\n${columnLines.join("\n")}`;
}

const ENUM_DESCRIPTIONS = `Enums:
- property_type: color, typography, shape, shadow, dimension, float
- token_type: color, gradient, typography, fontFamily, spacing, shape, shadow
- platform: web, android, ios
- property_platform: xml, compose, ios, web
- publication_status: publishing, published, failed
- operation: created, updated, deleted, moved
- relation_type: reuse, compose
- state: pressed, hovered, focused, selected, readonly, disabled
- palette_type: general, additional`;

const RELATIONSHIP_NOTES = `
Key relationships (foreign keys):
- design_system_users: user_id -> users.id, design_system_id -> design_systems.id
- design_system_components: design_system_id -> design_systems.id, component_id -> components.id
- design_system_versions: design_system_id -> design_systems.id, user_id -> users.id
- variations: component_id -> components.id
- properties: component_id -> components.id
- property_platform_params: property_id -> properties.id, platform (enum: xml, compose, ios, web), name (the platform-specific param name)
- property_variations: property_id -> properties.id, variation_id -> variations.id
- appearances: design_system_id -> design_systems.id, component_id -> components.id
- styles: design_system_id -> design_systems.id, variation_id -> variations.id
- tokens: design_system_id -> design_systems.id
- tenants: design_system_id -> design_systems.id
- token_values: token_id -> tokens.id, tenant_id -> tenants.id, palette_id -> palette.id (nullable)
- variation_property_values: property_id -> properties.id, style_id -> styles.id, appearance_id -> appearances.id, token_id -> tokens.id (nullable), state (nullable enum)
- invariant_property_values: property_id -> properties.id, design_system_id -> design_systems.id, component_id -> components.id, appearance_id -> appearances.id, token_id -> tokens.id (nullable), state (nullable enum)
- documentation_pages: design_system_id -> design_systems.id
- component_deps: parent_id -> components.id, child_id -> components.id, type (enum: reuse, compose)
- component_reuse_configs: component_dep_id -> component_deps.id, design_system_id -> design_systems.id, appearance_id -> appearances.id, variation_id -> variations.id, style_id -> styles.id
- style_combinations: property_id -> properties.id, appearance_id -> appearances.id
- style_combination_members: combination_id -> style_combinations.id, style_id -> styles.id
- design_system_changes: design_system_id -> design_systems.id, user_id -> users.id
- saved_queries: standalone table (id, label, sql, created_at)
- palette: standalone table (id, type, shade, saturation, value); unique on (type, shade, saturation).
  IMPORTANT: shade = color name in English, saturation = numeric level (50..1000), value = hex color code (e.g. '#FF293E'). When user asks about a color by name, filter by shade column (NOT value).
  General palette shades: red, orange, amber, gold, sunny, spring, herbal, green, arctic, malachite, skyBlue, blue, electricBlue, orchid, fuchsia, pink, coolGray, warmGray, gray.
  Additional palette shades: h0, h10, h20, ... h350 (hue-based).
  Translate Russian color names to English shade values: красный->red, оранжевый->orange, зелёный->green, синий->blue, розовый->pink, серый->gray, золотой->gold, голубой->skyBlue, фиолетовый->orchid.

Domain model:
- A design system (e.g. SDDS, PLASMA) contains components, tokens, tenants, appearances, and styles.
- Components have variations (e.g. size: S/M/L) and properties (e.g. color, typography).
- Styles belong to a variation within a design system. styles.is_default marks the default style per variation per DS.
- Properties are linked to variations via property_variations (many-to-many).
- variation_property_values store property values per style+appearance combo (optionally per state).
- invariant_property_values store property values that don't depend on a variation (per DS+component+appearance, optionally per state).
- Tokens are design-system-scoped; token_values store per-tenant per-platform values (optionally linked to palette).
- Palette stores color shades with saturation levels. type='general' = основная/обычная палитра, type='additional' = дополнительная палитра.
- component_deps tracks parent-child relationships between components (reuse or compose).

Common query patterns:
- To find design systems for a user: JOIN design_system_users ON user_id and design_system_id
- To find components in a design system: JOIN design_system_components ON design_system_id and component_id
- To find property values for a component: JOIN variation_property_values via styles (for variation-dependent) or invariant_property_values (for variation-independent)
- To find token values for a tenant: JOIN token_values ON token_id and tenant_id, optionally filter by platform
- To find palette colors for a token value: JOIN token_values ON palette_id = palette.id
- User login is in users.login (e.g., 'neretin', 'ivanov')
- Design system names are in design_systems.name (e.g., 'SDDS', 'PLASMA')
- The project_name column in design_systems stores values like 'sdds', 'plasma'
- appearances.name stores values like 'default', 'outline' — filter with ILIKE
- styles.name stores style names like 'S', 'M', 'L', 'XS', 'XL'`;

let cachedContext: string | null = null;

export function getSchemaContext(): string {
  if (cachedContext) return cachedContext;

  const tableDescriptions = drizzleTables
    .map(buildTableDescription)
    .join("\n\n");

  cachedContext = `Database: Design System Builder (PostgreSQL)

${ENUM_DESCRIPTIONS}

${tableDescriptions}

${RELATIONSHIP_NOTES}`;

  return cachedContext;
}
