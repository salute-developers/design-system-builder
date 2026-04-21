import { client } from './index';

// Drop everything and recreate schemas so db:migrate can run from scratch
async function reset() {
  await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await client`DROP SCHEMA public CASCADE`;
  await client`CREATE SCHEMA public`;
  await client`GRANT ALL ON SCHEMA public TO postgres`;
  await client`GRANT ALL ON SCHEMA public TO public`;
  console.log('Database reset complete. Run db:migrate next.');
}

reset()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => client.end());
