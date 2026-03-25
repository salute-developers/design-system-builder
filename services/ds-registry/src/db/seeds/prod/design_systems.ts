import * as schema from '../../schema';

export async function seedDesignSystems(db: any) {
  const rows = await db
    .insert(schema.designSystems)
    .values([
      {
        name: 'plasma_test',
        projectName: 'Plasma Test',
        description: 'Design System with all components',
      },
    ])
    .returning();

  const plasmaTest = rows[0]!;

  console.log(`  design_systems: plasmaTest(${plasmaTest.id})`);
  return { plasmaTest };
}
