import { sql } from 'drizzle-orm';
import * as schema from '../../schema';

export async function seedUsers(db: any) {
    const rows = await db
        .insert(schema.users)
        .values([
            { login: 'admin', token: 'YWRtaW46YWRtaW4=' },
            { login: 'neretin', token: 'bmVyZXRpbjpwYXNzd29yZA==' },
        ])
        .onConflictDoUpdate({
            target: schema.users.token,
            set: { login: sql`excluded.login` },
        })
        .returning();

    const admin = rows.find((r: any) => r.login === 'admin')!;
    const neretin = rows.find((r: any) => r.login === 'neretin')!;

    console.log(`  users: admin(${admin.id}), neretin(${neretin.id})`);
    return { admin, neretin };
}
