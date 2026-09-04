import { sql } from 'drizzle-orm';
import { db } from './index';
import { client } from './index';

async function truncateAll() {
  const tables = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );

  if (tables.length === 0) {
    console.log('No tables found.');
    return;
  }

  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE`));
  console.log(`Truncated ${tables.length} tables.`);
}

truncateAll()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => client.end());
