import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '../db/schema';
import { migrate } from 'drizzle-orm/pglite/migrator';

export async function setupTestDb() {
  // Create a new in-memory database
  const pglite = new PGlite();

  // Create drizzle instance
  const drizzleDb = drizzle(pglite, { schema });

  // Run migrations to create tables
  await migrate(drizzleDb, { migrationsFolder: './drizzle' });

  return drizzleDb;
} 