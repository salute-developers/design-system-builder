import { db, client } from './index';
import * as schema from './schema';
import { eq, and, inArray } from 'drizzle-orm';

import { seedDesignSystems } from './seeds/prod/design_systems';
import { seedTenants } from './seeds/prod/tenants';
import { seedPalette } from './seeds/prod/palette';
import { seedTokens } from './seeds/prod/tokens';
import { seedTokenValues } from './seeds/prod/token_values/index';
import { seedComponentDeps } from './seeds/prod/component_deps';
import { loadComponentSeeds, seedComponents } from './seeds/prod/component-seed';

// ─── CLI ─────────────────────────────────────────────────────────────────────

function getComponentArg(): string | undefined {
    const arg = process.argv.find((a) => a.startsWith('--component='));
    return arg ? arg.split('=')[1].replace(/["']/g, '') : undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Clear component-scoped data ONLY within a specific design system.
 * Variations and properties belong to the component globally,
 * but styles, vpv, ipv, appearances are scoped to a DS.
 * Does NOT delete the components themselves or their global variations/properties.
 */
async function clearComponentData(componentIds: string[], designSystemId: string) {
    if (componentIds.length === 0) return;

    // 1. Get variation IDs for these components
    const varRows = await db
        .select({ id: schema.variations.id })
        .from(schema.variations)
        .where(inArray(schema.variations.componentId, componentIds));
    const varIds = varRows.map((r) => r.id);

    // 2. Get style IDs scoped to this DS
    let styleIds: string[] = [];
    if (varIds.length > 0) {
        const styleRows = await db
            .select({ id: schema.styles.id })
            .from(schema.styles)
            .where(and(inArray(schema.styles.variationId, varIds), eq(schema.styles.designSystemId, designSystemId)));
        styleIds = styleRows.map((r) => r.id);
    }

    // 3. Get appearance IDs scoped to this DS
    const appRows = await db
        .select({ id: schema.appearances.id })
        .from(schema.appearances)
        .where(
            and(
                inArray(schema.appearances.componentId, componentIds),
                eq(schema.appearances.designSystemId, designSystemId),
            ),
        );
    const appIds = appRows.map((r) => r.id);

    // 4. Get VPV IDs (scoped via styles)
    let vpvIds: string[] = [];
    if (styleIds.length > 0) {
        const vpvRows = await db
            .select({ id: schema.variationPropertyValues.id })
            .from(schema.variationPropertyValues)
            .where(inArray(schema.variationPropertyValues.styleId, styleIds));
        vpvIds = vpvRows.map((r) => r.id);
    }

    // 5. Get IPV IDs scoped to this DS
    let ipvIds: string[] = [];
    const ipvRows = await db
        .select({ id: schema.invariantPropertyValues.id })
        .from(schema.invariantPropertyValues)
        .where(
            and(
                inArray(schema.invariantPropertyValues.componentId, componentIds),
                eq(schema.invariantPropertyValues.designSystemId, designSystemId),
            ),
        );
    ipvIds = ipvRows.map((r) => r.id);

    // 6. Delete in reverse FK order
    if (vpvIds.length > 0) {
        await db
            .delete(schema.variationPlatformParamAdjustments)
            .where(inArray(schema.variationPlatformParamAdjustments.vpvId, vpvIds));
    }
    if (ipvIds.length > 0) {
        await db
            .delete(schema.invariantPlatformParamAdjustments)
            .where(inArray(schema.invariantPlatformParamAdjustments.ipvId, ipvIds));
    }
    if (ipvIds.length > 0) {
        await db.delete(schema.invariantPropertyValues).where(inArray(schema.invariantPropertyValues.id, ipvIds));
    }
    if (vpvIds.length > 0) {
        await db.delete(schema.variationPropertyValues).where(inArray(schema.variationPropertyValues.id, vpvIds));
    }
    if (styleIds.length > 0) {
        await db.delete(schema.styles).where(inArray(schema.styles.id, styleIds));
    }

    // Delete appearances and DS-component links scoped to this DS
    if (appIds.length > 0) {
        await db.delete(schema.appearances).where(inArray(schema.appearances.id, appIds));
    }
    await db
        .delete(schema.designSystemComponents)
        .where(
            and(
                inArray(schema.designSystemComponents.componentId, componentIds),
                eq(schema.designSystemComponents.designSystemId, designSystemId),
            ),
        );

    // NOTE: variations, properties, property_variations, property_platform_params
    // are global (not DS-scoped) — they get upserted, not deleted.

    console.log(`  Cleared component data for ${componentIds.length} component(s) in DS ${designSystemId}`);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
    const targetComponent = getComponentArg();
    const allSeeds = loadComponentSeeds();
    const seeds = targetComponent ? allSeeds.filter((item) => item.name === targetComponent) : allSeeds;

    if (targetComponent && seeds.length === 0) {
        console.error(
            `Unknown component: "${targetComponent}". Available: ${allSeeds.map((item) => item.name).join(', ')}`,
        );
        process.exit(1);
    }
    console.log(targetComponent ? `Seeding component: ${targetComponent}\n` : 'Seeding all (full prod seed)\n');

    // ── 1. Глобальные данные ─────────────────────────────────────────────────

    const designSystems = await seedDesignSystems(db);
    const tenants = await seedTenants(db, { designSystems });
    await seedPalette(db);
    const tokenMap = await seedTokens(db, { designSystems });
    await seedTokenValues(db, { tokenMap, tenant: tenants.baseDefaultTenant });

    // ── 2. Данные дизайн-системы у пересеваемых компонентов чистятся ─────────

    const existing = await db
        .select({ id: schema.components.id })
        .from(schema.components)
        .where(
            inArray(
                schema.components.name,
                seeds.map((item) => item.name),
            ),
        );
    await clearComponentData(
        existing.map((row) => row.id),
        designSystems.base.id,
    );

    // ── 3. Компоненты: каждая папка seeds/prod/components/<имя> ──────────────

    await seedComponents(db, { designSystem: designSystems.base, tokenMap }, seeds);
    await seedComponentDeps(db);

    console.log('\nProd seed completed successfully!');
}

seed()
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(() => client.end());
