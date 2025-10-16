import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>; 