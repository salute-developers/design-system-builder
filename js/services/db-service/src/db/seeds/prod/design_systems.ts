import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../../schema';

/** Версия, с которой `base` попадает в выгрузку компонентов. */
const BASE_INITIAL_VERSION = '0.1.0';

export async function seedDesignSystems(db: any) {
    const [base] = await db
        .insert(schema.designSystems)
        .values([
            {
                name: 'base',
                projectName: 'Base',
                description: 'Default design system for creating base components',
            },
        ])
        .onConflictDoUpdate({
            target: schema.designSystems.name,
            set: {
                projectName: sql`excluded.project_name`,
                description: sql`excluded.description`,
            },
        })
        .returning();

    console.log(`  design_systems: base(${base.id})`);

    await seedInitialVersion(db, base.id);

    return { base };
}

/**
 * Без опубликованной версии выгрузка компонентов отказывает. Версия пишется только в
 * пустую историю: повторный прогон с `published_at = now()` иначе обогнал бы реальные версии.
 */
async function seedInitialVersion(db: any, designSystemId: string) {
    const [published] = await db
        .select({ version: schema.designSystemVersions.version })
        .from(schema.designSystemVersions)
        .where(
            and(
                eq(schema.designSystemVersions.designSystemId, designSystemId),
                eq(schema.designSystemVersions.publicationStatus, 'published'),
            ),
        )
        .limit(1);

    if (published) {
        console.log(`  design_system_versions: base already published (${published.version})`);
        return;
    }

    await db
        .insert(schema.designSystemVersions)
        .values({
            designSystemId,
            version: BASE_INITIAL_VERSION,
            snapshot: {},
            publicationStatus: 'published',
        })
        .onConflictDoNothing();

    console.log(`  design_system_versions: base(${BASE_INITIAL_VERSION})`);
}
