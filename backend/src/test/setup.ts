import { afterEach, beforeAll } from 'vitest';
import { setupTestDb } from './db';
import * as schema from '../db/schema';
import { Database } from '../db/types';

let testDb: Database;

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterEach(async () => {
  // Clean up all tables after each test
  await testDb.delete(schema.tokenValues).execute();
  await testDb.delete(schema.variationValues).execute();
  await testDb.delete(schema.tokens).execute();
  await testDb.delete(schema.variations).execute();
  await testDb.delete(schema.propsAPI).execute();
  await testDb.delete(schema.designSystemComponents).execute();
  await testDb.delete(schema.components).execute();
  await testDb.delete(schema.designSystems).execute();
});

export { testDb }; 