import * as schema from '../../schema';

export async function seedTenants(
  db: any,
  ctx: { designSystems: { plasmaTest: any } },
) {
  const { plasmaTest } = ctx.designSystems;

  const [plasmaTestTenant] = await db
    .insert(schema.tenants)
    .values([
      {
        designSystemId: plasmaTest.id,
        name: 'plasma_test_default',
        colorConfig: {
          grayTone: 'warmGray',
          accentColor: 'arctic',
          light: { strokeSaturation: 700, fillSaturation: 600 },
          dark: { strokeSaturation: 400, fillSaturation: 400 },
        },
      },
    ])
    .returning();

  console.log(`  tenants: plasmaTestTenant(${plasmaTestTenant.id})`);
  return { plasmaTestTenant };
}
