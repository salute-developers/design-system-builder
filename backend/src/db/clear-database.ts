import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function clearDatabase() {
  console.log('🧹 Clearing database...');

  try {
    // Clear data in correct order (respecting foreign key constraints)
    console.log('  Deleting token values...');
    await db.delete(schema.tokenValues);
    
    console.log('  Deleting token-variation assignments...');
    await db.delete(schema.tokenVariations);
    
    console.log('  Deleting variation values...');
    await db.delete(schema.variationValues);
    
    console.log('  Deleting props API...');
    await db.delete(schema.propsAPI);
    
    console.log('  Deleting tokens...');
    await db.delete(schema.tokens);
    
    console.log('  Deleting variations...');
    await db.delete(schema.variations);
    
    console.log('  Deleting design system-component relationships...');
    await db.delete(schema.designSystemComponents);
    
    console.log('  Deleting components...');
    await db.delete(schema.components);
    
    console.log('  Deleting design systems...');
    await db.delete(schema.designSystems);

    console.log('✅ Database cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the clear function
if (require.main === module) {
  clearDatabase().catch((error) => {
    console.error('Clear failed:', error);
    process.exit(1);
  });
}

export { clearDatabase };
