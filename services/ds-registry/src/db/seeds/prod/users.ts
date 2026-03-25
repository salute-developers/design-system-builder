import * as schema from '../../schema';

export async function seedUsers(db: any) {
  const rows = await db
    .insert(schema.users)
    .values([
      { login: 'neretin', token: 'bmVyZXRpbjpwYXNzd29yZA==' }, // password
      { login: 'client', token: 'Y2xpZW50OmNsaWVudA==' }, // client
    ])
    .returning();

  const neretin = rows.find((r: any) => r.login === 'neretin')!;
  const client = rows.find((r: any) => r.login === 'client')!;

  console.log(`  users: neretin(${neretin.id}), client(${client.id})`);
  return { neretin, client };
}
