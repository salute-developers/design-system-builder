// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
// import * as schema from './schema';
// import * as dotenv from 'dotenv';
// dotenv.config();
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// const client = postgres(connectionString);
// export const db = drizzle(client, { schema }); 

export const db = drizzle(connectionString);
