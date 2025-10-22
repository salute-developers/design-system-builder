import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default {
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // host: process.env.DB_HOST || 'localhost',
    // port: Number(process.env.DB_PORT) || 5432,
    // user: process.env.DB_USER || 'postgres',
    // password: process.env.DB_PASSWORD || 'postgres',
    // database: process.env.DB_NAME || 'ds_builder',
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ds_builder',
  },
} satisfies Config;

