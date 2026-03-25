import { db, client } from './index';
import * as schema from './schema';

import { seedUsers } from './seeds/prod/users';
import { seedDesignSystems } from './seeds/prod/design_systems';
import { seedDesignSystemUsers } from './seeds/prod/design_system_users';
import { seedTenants } from './seeds/prod/tenants';
import { seedIconButtonComponent, seedButtonComponent, seedLinkComponent, seedCheckboxComponent, seedRadioboxComponent } from './seeds/prod/components';
import { seedDesignSystemComponents } from './seeds/prod/design_system_components';
import { seedAppearances } from './seeds/prod/appearances';
import { seedVariations } from './seeds/prod/variations';
import { seedProperties } from './seeds/prod/properties';
import { seedPropertyVariations } from './seeds/prod/property_variations';
import { seedStyles } from './seeds/prod/styles';
import { seedVariationPropertyValues } from './seeds/prod/variation_property_values';
import { seedInvariantPropertyValues } from './seeds/prod/invariant_property_values';
import { seedPalette } from './seeds/prod/palette';
import { seedTokens } from './seeds/prod/tokens';
import { seedTokenValues } from './seeds/prod/token_values/index';
import { seedVariationPlatformParamAdjustments } from './seeds/prod/variation_platform_param_adjustments';
import { seedInvariantPlatformParamAdjustments } from './seeds/prod/invariant_platform_param_adjustments';

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
  console.log('Starting prod seed...\n');

  await clearAll();

  console.log('Inserting data...');

  const users = await seedUsers(db);
  const designSystems = await seedDesignSystems(db);
  await seedDesignSystemUsers(db, { users, designSystems });
  const tenants = await seedTenants(db, { designSystems });
  await seedPalette(db);
  const tokenMap = await seedTokens(db, { designSystems });
  await seedTokenValues(db, { tokenMap, tenant: tenants.plasmaTestTenant });

  const components = {
    iconButton: await seedIconButtonComponent(db),
    button: await seedButtonComponent(db),
    link: await seedLinkComponent(db),
    checkbox: await seedCheckboxComponent(db),
    radiobox: await seedRadioboxComponent(db),
  };
  await seedDesignSystemComponents(db, { designSystems, components });
  const appearances = await seedAppearances(db, { designSystems, components });
  const variations = await seedVariations(db, { components });
  const properties = await seedProperties(db, { components });
  await seedPropertyVariations(db, { properties, variations });
  const styles = await seedStyles(db, { designSystems, variations });
  const vpvRows = await seedVariationPropertyValues(db, { appearances, properties, styles, tokenMap });
  const ipvRows = await seedInvariantPropertyValues(db, { designSystems, components, appearances, properties, tokenMap });
  await seedVariationPlatformParamAdjustments(db, { vpvRows, properties, styles });
  await seedInvariantPlatformParamAdjustments(db, { ipvRows, properties });

  console.log('\nProd seed completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => client.end());
