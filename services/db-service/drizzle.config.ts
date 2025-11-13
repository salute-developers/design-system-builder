import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ds_builder';

export default {
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
} satisfies Config;

