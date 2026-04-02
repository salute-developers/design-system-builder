import * as schema from '../../schema';

export async function seedTenants(
  db: any,
  ctx: { designSystems: { base: any } },
) {
  const { base } = ctx.designSystems;

  const [baseDefaultTenant] = await db
    .insert(schema.tenants)
    .values([
      {
        designSystemId: base.id,
        name: 'base_default',
        colorConfig: {
          grayTone: 'warmGray',
          accentColor: 'arctic',
          light: { strokeSaturation: 700, fillSaturation: 600 },
          dark: { strokeSaturation: 400, fillSaturation: 400 },
        },
      },
    ])
    .returning();

  console.log(`  tenants: baseDefaultTenant(${baseDefaultTenant.id})`);
  return { baseDefaultTenant };
}
