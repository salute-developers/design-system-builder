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

    await db
        .insert(schema.designSystemUsers)
        .values([{ userId: admin.id, designSystemId: base.id }])
        .onConflictDoNothing();

    console.log(`  design_system_users: done`);
}
