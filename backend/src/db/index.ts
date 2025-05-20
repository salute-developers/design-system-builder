// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// import * as schema from './schema';
// import * as dotenv from 'dotenv';
// dotenv.config();
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

const pool = new Pool({
  connectionString,
});

// Create a custom logger
const logger = {
  log: (message: string, ...args: any[]) => {
    console.log(`[DB] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[DB Error] ${message}`, ...args);
  },
  query: (query: string, params: any[]) => {
    console.log(`[DB Query] ${query}`, params);
  }
};

// Add event listeners to the pool
pool.on('connect', () => {
  logger.log('New client connected to the database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { 
  schema,
  // logger: {
  //   logQuery: (query: string, params: any[]) => {
  //     logger.query(query, params);
  //   }
  // }
});

export { logger };
