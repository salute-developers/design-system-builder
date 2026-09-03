import * as schema from '../../schema';

export async function seedDesignSystems(db: any) {
  const rows = await db
    .insert(schema.designSystems)
    .values([
      { name: 'SDDS', projectName: 'sdds', description: 'Дизайн система для вертикали SDDS' },
      { name: 'PLASMA', projectName: 'plasma', description: 'Дизайн система для вертикали PLASMA' },
    ])
    .returning();

  const sdds = rows.find((r: any) => r.projectName === 'sdds')!;
  const plasma = rows.find((r: any) => r.projectName === 'plasma')!;

  console.log(`  design_systems: sdds(${sdds.id}), plasma(${plasma.id})`);
  return { sdds, plasma };
}
