import * as schema from '../../schema';

export async function seedDesignSystems(db: any) {
  const rows = await db
    .insert(schema.designSystems)
    .values([
      {
        name: 'base',
        projectName: 'Base',
        description: 'Default design system for creating base components',
      },
    ])
    .returning();

  const base = rows[0]!;

  console.log(`  design_systems: base(${base.id})`);
  return { base };
}
