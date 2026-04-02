import { sql } from 'drizzle-orm';
import * as schema from '../../schema';

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
    return { base };
}
