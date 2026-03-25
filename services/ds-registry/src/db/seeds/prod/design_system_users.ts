import * as schema from '../../schema';

export async function seedDesignSystemUsers(
  db: any,
  ctx: {
    users: { neretin: any; client: any };
    designSystems: { plasmaTest: any };
  },
) {
  const { neretin, client } = ctx.users;
  const { plasmaTest } = ctx.designSystems;

  const rows = await db
    .insert(schema.designSystemUsers)
    .values([
      { userId: neretin.id, designSystemId: plasmaTest.id },
      { userId: client.id, designSystemId: plasmaTest.id },
    ])
    .returning();

  console.log(`  design_system_users: ${rows.length} rows`);
}
