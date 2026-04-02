import * as schema from '../../schema';

export async function seedDesignSystemUsers(
  db: any,
  ctx: {
    users: { admin: any };
    designSystems: { base: any };
  },
) {
  const { admin } = ctx.users;
  const { base } = ctx.designSystems;

  const rows = await db
    .insert(schema.designSystemUsers)
    .values([
      { userId: admin.id, designSystemId: base.id },
    ])
    .returning();

  console.log(`  design_system_users: ${rows.length} rows`);
}
