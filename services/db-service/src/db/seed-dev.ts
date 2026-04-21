import { db, client } from './index';
import * as schema from './schema';

import { seedUsers } from './seeds/dev/users';
import { seedDesignSystems } from './seeds/dev/design_systems';
import { seedDesignSystemUsers } from './seeds/dev/design_system_users';
import { seedComponents } from './seeds/dev/components';
import { seedComponentDeps } from './seeds/dev/component_deps';
import { seedDesignSystemComponents } from './seeds/dev/design_system_components';
import { seedAppearances } from './seeds/dev/appearances';
import { seedTokens } from './seeds/dev/tokens';
import { seedTenants } from './seeds/dev/tenants';
import { seedTokenValues } from './seeds/dev/token_values';
import { seedVariations } from './seeds/dev/variations';
import { seedProperties } from './seeds/dev/properties';
import { seedPropertyVariations } from './seeds/dev/property_variations';
import { seedStyles } from './seeds/dev/styles';
import { seedVariationPropertyValues } from './seeds/dev/variation_property_values';
import { seedInvariantPropertyValues } from './seeds/dev/invariant_property_values';
import { seedStyleCombinations } from './seeds/dev/style_combinations';
import { seedStyleCombinationMembers } from './seeds/dev/style_combination_members';
import { seedDocumentationPages } from './seeds/dev/documentation_pages';
import { seedDesignSystemChanges } from './seeds/dev/design_system_changes';
import { seedDesignSystemVersions, updateDesignSystemVersionSnapshots } from './seeds/dev/design_system_versions';
import { seedPalette } from './seeds/dev/palette';
import { seedComponentReuseConfigs } from './seeds/dev/component_reuse_configs';
import { seedVariationPlatformParamAdjustments } from './seeds/dev/variation_platform_param_adjustments';
import { seedInvariantPlatformParamAdjustments } from './seeds/dev/invariant_platform_param_adjustments';

// ─── Clear ────────────────────────────────────────────────────────────────────
// Delete in reverse FK dependency order
async function clearAll() {
  console.log('Clearing tables...');
  await db.delete(schema.designSystemChanges);
  await db.delete(schema.documentationPages);
  await db.delete(schema.styleCombinationMembers);
  await db.delete(schema.styleCombinations);
  await db.delete(schema.componentReuseConfigs);
  await db.delete(schema.variationPlatformParamAdjustments);
  await db.delete(schema.invariantPlatformParamAdjustments);
  await db.delete(schema.invariantPropertyValues);
  await db.delete(schema.variationPropertyValues);
  await db.delete(schema.styles);
  await db.delete(schema.propertyVariations);
  await db.delete(schema.propertyPlatformParams);
  await db.delete(schema.properties);
  await db.delete(schema.variations);
  await db.delete(schema.tokenValues);
  await db.delete(schema.palette);
  await db.delete(schema.tenants);
  await db.delete(schema.tokens);
  await db.delete(schema.appearances);
  await db.delete(schema.designSystemComponents);
  await db.delete(schema.componentDeps);
  await db.delete(schema.components);
  await db.delete(schema.designSystemVersions);
  await db.delete(schema.designSystemUsers);
  await db.delete(schema.designSystems);
  await db.delete(schema.users);
  console.log('All tables cleared.\n');
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('Starting seed...\n');

  await clearAll();

  console.log('Inserting data...');

  const users = await seedUsers(db);
  const designSystems = await seedDesignSystems(db);
  await seedDesignSystemUsers(db, { users, designSystems });

  // Create stub versions first so other seeds can reference them via designSystemVersionId
  const versions = await seedDesignSystemVersions(db, { users, designSystems });

  // Token-related seeds (grouped together, matching prod order)
  const tenants = await seedTenants(db, { designSystems });
  await seedPalette(db);
  const tokens = await seedTokens(db, { designSystems });
  await seedTokenValues(db, { tokens, tenants });

  // Component structure seeds
  const components = await seedComponents(db);
  const componentDeps = await seedComponentDeps(db, { components });
  await seedDesignSystemComponents(db, { designSystems, components });
  const appearances = await seedAppearances(db, { designSystems, components });

  // Variation & property seeds
  const variations = await seedVariations(db, { components });
  const properties = await seedProperties(db, { components });
  await seedPropertyVariations(db, { properties, variations });
  const styles = await seedStyles(db, { designSystems, variations });

  // Property value seeds
  const vpvRows = await seedVariationPropertyValues(db, { tokens, appearances, properties, styles });
  const ipvRows = await seedInvariantPropertyValues(db, { tokens, designSystems, components, appearances, properties });
  await seedVariationPlatformParamAdjustments(db, { vpvRows, properties });
  await seedInvariantPlatformParamAdjustments(db, { ipvRows, properties });

  // Combinations, configs, and audit
  const styleCombinations = await seedStyleCombinations(db, { appearances, properties });
  await seedStyleCombinationMembers(db, { styleCombinations, styles });
  await seedComponentReuseConfigs(db, { designSystems, componentDeps, appearances, variations, styles });
  await seedDocumentationPages(db, { designSystems });
  await seedDesignSystemChanges(db, { users, designSystems, tokens, styles, variations, tenants, appearances, properties });

  // Update version snapshots with real data now that everything is seeded
  await updateDesignSystemVersionSnapshots(db, {
    versions,
    tokens,
    components,
    variations,
    styles,
    appearances,
    tenants,
    designSystems,
  });

  console.log('\nSeed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => client.end());
