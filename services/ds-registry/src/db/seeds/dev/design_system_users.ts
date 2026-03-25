import * as schema from '../../schema';

export async function seedDesignSystemUsers(
  db: any,
  ctx: {
    users: { neretin: any; client: any };
    designSystems: { sdds: any; plasma: any };
  },
) {
  const { neretin, client } = ctx.users;
  const { sdds, plasma } = ctx.designSystems;

  const rows = await db
    .insert(schema.designSystemUsers)
    .values([
      { userId: neretin.id, designSystemId: sdds.id },
      { userId: client.id, designSystemId: sdds.id },
      { userId: neretin.id, designSystemId: plasma.id },
    ])
    .returning();

  console.log(`  design_system_users: ${rows.length} rows`);
  return rows;
}
