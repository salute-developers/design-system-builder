import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ds_builder';

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

interface ExtractedData {
  designSystems: any[];
  components: any[];
  variations: any[];
  tokens: any[];
  tokenVariations: any[];
  variationValues: any[];
  tokenValues: any[];
  designSystemComponents: any[];
  propsAPI: any[];
  invariantTokenValues: any[];
}

async function extractCurrentState(): Promise<ExtractedData> {
  console.log('🔍 Extracting current database state...');

  try {
    // Extract all data with relationships
    const [
      designSystems,
      components,
      variations,
      tokens,
      tokenVariations,
      variationValues,
      tokenValues,
      designSystemComponents,
      propsAPI,
      invariantTokenValues
    ] = await Promise.all([
      db.query.designSystems.findMany(),
      db.query.components.findMany({
        with: {
          variations: true,
          tokens: true,
          propsAPI: true
        }
      }),
      db.query.variations.findMany({
        with: {
          tokenVariations: {
            with: {
              token: true
            }
          }
        }
      }),
      db.query.tokens.findMany(),
      db.query.tokenVariations.findMany(),
      db.query.variationValues.findMany({
        with: {
          tokenValues: {
            with: {
              token: true
            }
          }
        }
      }),
      db.query.tokenValues.findMany({
        with: {
          token: true
        }
      }),
      db.query.designSystemComponents.findMany(),
      db.query.propsAPI.findMany(),
      db.query.tokenValues.findMany({
        where: (tokenValues, { eq }) => eq(tokenValues.type, 'invariant'),
        with: {
          token: true
        }
      })
    ]);

    console.log('✅ Data extraction completed!');
    console.log(`📊 Found:`);
    console.log(`  - ${designSystems.length} design systems`);
    console.log(`  - ${components.length} components`);
    console.log(`  - ${variations.length} variations`);
    console.log(`  - ${tokens.length} tokens`);
    console.log(`  - ${tokenVariations.length} token-variation assignments`);
    console.log(`  - ${variationValues.length} variation values`);
    console.log(`  - ${tokenValues.length} token values`);
    console.log(`  - ${designSystemComponents.length} design system-component relationships`);
    console.log(`  - ${propsAPI.length} props API entries`);
    console.log(`  - ${invariantTokenValues.length} invariant token values`);

    return {
      designSystems,
      components,
      variations,
      tokens,
      tokenVariations,
      variationValues,
      tokenValues,
      designSystemComponents,
      propsAPI,
      invariantTokenValues
    };

  } catch (error) {
    console.error('❌ Error extracting data:', error);
    throw error;
  }
}

function generateSeedScript(data: ExtractedData): string {
  console.log('📝 Generating seed script with inline data...');

  const script = `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

// Get database URL from environment or use default
const connectionString = \`postgres://\${process.env.DB_USER || 'postgres'}:\${process.env.DB_PASSWORD || 'postgres'}@\${process.env.DB_HOST || 'localhost'}:\${process.env.DB_PORT || 5432}/\${process.env.DB_NAME || 'ds_builder'}\`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Extracted data from current database state
const extractedData = ${JSON.stringify(data, null, 2)};

async function seedFromExtractedData(clearDatabase = false) {
  console.log('🌱 Starting database seed from extracted data...');

  if (clearDatabase) {
    console.log('⚠️  WARNING: This will clear all existing data!');
    console.log('🧹 Clearing existing data...');
    await db.delete(schema.tokenValues);
    await db.delete(schema.tokenVariations);
    await db.delete(schema.variationValues);
    await db.delete(schema.propsAPI);
    await db.delete(schema.tokens);
    await db.delete(schema.variations);
    await db.delete(schema.designSystemComponents);
    await db.delete(schema.components);
    await db.delete(schema.designSystems);
  } else {
    console.log('ℹ️  Adding data to existing database (no clearing)');
  }

  try {
    // Insert Design Systems
    console.log('📊 Creating design systems...');
    const designSystemInserts = extractedData.designSystems.map(ds => ({
      name: ds.name,
      description: ds.description
    }));
    const insertedDesignSystems = await db.insert(schema.designSystems).values(designSystemInserts).returning();
    console.log(\`✅ Created \${insertedDesignSystems.length} design systems\`);

    // Create ID mapping for design systems
    const designSystemIdMap = new Map();
    extractedData.designSystems.forEach((ds, index) => {
      designSystemIdMap.set(ds.id, insertedDesignSystems[index].id);
    });

    // Insert Components
    console.log('🔧 Creating components...');
    const componentInserts = extractedData.components.map(c => ({
      name: c.name,
      description: c.description
    }));
    const insertedComponents = await db.insert(schema.components).values(componentInserts).returning();
    console.log(\`✅ Created \${insertedComponents.length} components\`);

    // Create ID mapping for components
    const componentIdMap = new Map();
    extractedData.components.forEach((comp, index) => {
      componentIdMap.set(comp.id, insertedComponents[index].id);
    });

    // Insert Variations
    console.log('🎨 Creating variations...');
    const variationInserts = extractedData.variations.map(variation => ({
      name: variation.name,
      description: variation.description,
      componentId: componentIdMap.get(variation.componentId)
    }));
    const insertedVariations = await db.insert(schema.variations).values(variationInserts).returning();
    console.log(\`✅ Created \${insertedVariations.length} variations\`);

    // Create ID mapping for variations
    const variationIdMap = new Map();
    extractedData.variations.forEach((variation, index) => {
      variationIdMap.set(variation.id, insertedVariations[index].id);
    });

    // Insert Tokens
    console.log('🎯 Creating tokens...');
    const tokenInserts = extractedData.tokens.map(token => ({
      name: token.name,
      description: token.description,
      type: token.type,
      defaultValue: token.defaultValue,
      componentId: componentIdMap.get(token.componentId),
      xmlParam: token.xmlParam,
      composeParam: token.composeParam,
      iosParam: token.iosParam,
      webParam: token.webParam
    }));
    const insertedTokens = await db.insert(schema.tokens).values(tokenInserts).returning();
    console.log(\`✅ Created \${insertedTokens.length} tokens\`);

    // Create ID mapping for tokens
    const tokenIdMap = new Map();
    extractedData.tokens.forEach((token, index) => {
      tokenIdMap.set(token.id, insertedTokens[index].id);
    });

    // Insert Token-Variation Assignments
    console.log('🔗 Creating token-variation assignments...');
    const tokenVariationInserts = extractedData.tokenVariations.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      variationId: variationIdMap.get(tv.variationId)
    }));
    await db.insert(schema.tokenVariations).values(tokenVariationInserts);
    console.log(\`✅ Created \${tokenVariationInserts.length} token-variation assignments\`);

    // Insert Design System Components
    console.log('🔗 Creating design system-component relationships...');
    const designSystemComponentInserts = extractedData.designSystemComponents.map(dsc => ({
      designSystemId: designSystemIdMap.get(dsc.designSystemId),
      componentId: componentIdMap.get(dsc.componentId)
    }));
    await db.insert(schema.designSystemComponents).values(designSystemComponentInserts);
    console.log(\`✅ Created \${designSystemComponentInserts.length} design system-component relationships\`);

    // Insert Props API
    console.log('⚙️ Creating props API...');
    const propsAPIInserts = extractedData.propsAPI.map(props => ({
      componentId: componentIdMap.get(props.componentId),
      name: props.name,
      value: props.value
    }));
    await db.insert(schema.propsAPI).values(propsAPIInserts);
    console.log(\`✅ Created \${propsAPIInserts.length} props API entries\`);

    // Insert Variation Values
    console.log('📝 Creating variation values...');
    const variationValueInserts = extractedData.variationValues.map(vv => ({
      designSystemId: designSystemIdMap.get(vv.designSystemId),
      componentId: componentIdMap.get(vv.componentId),
      variationId: variationIdMap.get(vv.variationId),
      name: vv.name,
      description: vv.description,
      isDefaultValue: vv.isDefaultValue
    }));
    const insertedVariationValues = await db.insert(schema.variationValues).values(variationValueInserts).returning();
    console.log(\`✅ Created \${insertedVariationValues.length} variation values\`);

    // Create ID mapping for variation values
    const variationValueIdMap = new Map();
    extractedData.variationValues.forEach((vv, index) => {
      variationValueIdMap.set(vv.id, insertedVariationValues[index].id);
    });

    // Insert Token Values (variation values)
    console.log('🎨 Creating token values for variation values...');
    const variationTokenValueInserts = extractedData.tokenValues
      .filter(tv => tv.variationValueId)
      .map(tv => ({
        variationValueId: variationValueIdMap.get(tv.variationValueId),
        tokenId: tokenIdMap.get(tv.tokenId),
        value: tv.value
      }));
    await db.insert(schema.tokenValues).values(variationTokenValueInserts);
    console.log(\`✅ Created \${variationTokenValueInserts.length} variation token values\`);

    // Insert Invariant Token Values
    console.log('🔒 Creating invariant token values...');
    const invariantTokenValueInserts = extractedData.invariantTokenValues.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      value: tv.value,
      type: tv.type,
      componentId: componentIdMap.get(tv.componentId),
      designSystemId: designSystemIdMap.get(tv.designSystemId)
    }));
    await db.insert(schema.tokenValues).values(invariantTokenValueInserts);
    console.log(\`✅ Created \${invariantTokenValueInserts.length} invariant token values\`);

    console.log('\\n✅ Seed from extracted data completed successfully!');
    console.log('📊 Summary:');
    console.log(\`  • \${insertedDesignSystems.length} Design Systems\`);
    console.log(\`  • \${insertedComponents.length} Components\`);
    console.log(\`  • \${insertedVariations.length} Variations\`);
    console.log(\`  • \${insertedTokens.length} Tokens\`);
    console.log(\`  • \${tokenVariationInserts.length} Token-Variation Assignments\`);
    console.log(\`  • \${designSystemComponentInserts.length} Design System-Component Relationships\`);
    console.log(\`  • \${propsAPIInserts.length} Props API Entries\`);
    console.log(\`  • \${insertedVariationValues.length} Variation Values\`);
    console.log(\`  • \${variationTokenValueInserts.length} Variation Token Values\`);
    console.log(\`  • \${invariantTokenValueInserts.length} Invariant Token Values\`);

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
if (require.main === module) {
  const clearDatabase = process.argv.includes('--clear');
  
  async function runSeed() {
    if (clearDatabase) {
      console.log('⚠️  WARNING: Running with --clear flag will delete all existing data!');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await seedFromExtractedData(clearDatabase);
  }
  
  runSeed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export { seedFromExtractedData };
`;

  return script;
}

async function main() {
  try {
    // Extract current state
    console.log('🚀 Starting extraction and save process...');
    const data = await extractCurrentState();

    // Save raw data as JSON
    const jsonPath = path.join(__dirname, 'current-state.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    console.log(`📁 Raw data saved to: ${jsonPath}`);

    // Generate seed script with inline data
    const seedScript = generateSeedScript(data);
    const scriptPath = path.join(__dirname, 'seed-from-saved-state.ts');
    fs.writeFileSync(scriptPath, seedScript);
    console.log(`📁 Seed script saved to: ${scriptPath}`);

    console.log('\n✅ Extraction and save completed!');
    console.log('📋 You can now:');
    console.log('  1. Use the raw JSON data for other purposes');
    console.log('  2. Run: npm run seed-saved-state');
    console.log('  3. The seed script contains all your data inline');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the extraction
if (require.main === module) {
  main();
}

export { extractCurrentState, generateSeedScript };
