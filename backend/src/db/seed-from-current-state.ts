import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

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

async function seedFromCurrentState() {
  console.log('🌱 Starting database seed from current state...');

  try {
    // First extract current state
    const data = await extractCurrentState();

    // Insert Design Systems
    console.log('📊 Creating design systems...');
    const designSystemInserts = data.designSystems.map(ds => ({
      name: ds.name,
      description: ds.description
    }));
    const insertedDesignSystems = await db.insert(schema.designSystems).values(designSystemInserts).returning();
    console.log(`✅ Created ${insertedDesignSystems.length} design systems`);

    // Create ID mapping for design systems
    const designSystemIdMap = new Map();
    data.designSystems.forEach((ds, index) => {
      designSystemIdMap.set(ds.id, insertedDesignSystems[index].id);
    });

    // Insert Components
    console.log('🔧 Creating components...');
    const componentInserts = data.components.map(c => ({
      name: c.name,
      description: c.description
    }));
    const insertedComponents = await db.insert(schema.components).values(componentInserts).returning();
    console.log(`✅ Created ${insertedComponents.length} components`);

    // Create ID mapping for components
    const componentIdMap = new Map();
    data.components.forEach((comp, index) => {
      componentIdMap.set(comp.id, insertedComponents[index].id);
    });

    // Insert Variations
    console.log('🎨 Creating variations...');
    const variationInserts = data.variations.map(variation => ({
      name: variation.name,
      description: variation.description,
      componentId: componentIdMap.get(variation.componentId)
    }));
    const insertedVariations = await db.insert(schema.variations).values(variationInserts).returning();
    console.log(`✅ Created ${insertedVariations.length} variations`);

    // Create ID mapping for variations
    const variationIdMap = new Map();
    data.variations.forEach((variation, index) => {
      variationIdMap.set(variation.id, insertedVariations[index].id);
    });

    // Insert Tokens
    console.log('🎯 Creating tokens...');
    const tokenInserts = data.tokens.map(token => ({
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
    console.log(`✅ Created ${insertedTokens.length} tokens`);

    // Create ID mapping for tokens
    const tokenIdMap = new Map();
    data.tokens.forEach((token, index) => {
      tokenIdMap.set(token.id, insertedTokens[index].id);
    });

    // Insert Token-Variation Assignments
    console.log('🔗 Creating token-variation assignments...');
    const tokenVariationInserts = data.tokenVariations.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      variationId: variationIdMap.get(tv.variationId)
    }));
    await db.insert(schema.tokenVariations).values(tokenVariationInserts);
    console.log(`✅ Created ${tokenVariationInserts.length} token-variation assignments`);

    // Insert Design System Components
    console.log('🔗 Creating design system-component relationships...');
    const designSystemComponentInserts = data.designSystemComponents.map(dsc => ({
      designSystemId: designSystemIdMap.get(dsc.designSystemId),
      componentId: componentIdMap.get(dsc.componentId)
    }));
    await db.insert(schema.designSystemComponents).values(designSystemComponentInserts);
    console.log(`✅ Created ${designSystemComponentInserts.length} design system-component relationships`);

    // Insert Props API
    console.log('⚙️ Creating props API...');
    const propsAPIInserts = data.propsAPI.map(props => ({
      componentId: componentIdMap.get(props.componentId),
      name: props.name,
      value: props.value
    }));
    await db.insert(schema.propsAPI).values(propsAPIInserts);
    console.log(`✅ Created ${propsAPIInserts.length} props API entries`);

    // Insert Variation Values
    console.log('📝 Creating variation values...');
    const variationValueInserts = data.variationValues.map(vv => ({
      designSystemId: designSystemIdMap.get(vv.designSystemId),
      componentId: componentIdMap.get(vv.componentId),
      variationId: variationIdMap.get(vv.variationId),
      name: vv.name,
      description: vv.description,
      isDefaultValue: vv.isDefaultValue
    }));
    const insertedVariationValues = await db.insert(schema.variationValues).values(variationValueInserts).returning();
    console.log(`✅ Created ${insertedVariationValues.length} variation values`);

    // Create ID mapping for variation values
    const variationValueIdMap = new Map();
    data.variationValues.forEach((vv, index) => {
      variationValueIdMap.set(vv.id, insertedVariationValues[index].id);
    });

    // Insert Token Values (variation values)
    console.log('🎨 Creating token values for variation values...');
    const variationTokenValueInserts = data.tokenValues
      .filter(tv => tv.variationValueId)
      .map(tv => ({
        variationValueId: variationValueIdMap.get(tv.variationValueId),
        tokenId: tokenIdMap.get(tv.tokenId),
        value: tv.value
      }));
    await db.insert(schema.tokenValues).values(variationTokenValueInserts);
    console.log(`✅ Created ${variationTokenValueInserts.length} variation token values`);

    // Insert Invariant Token Values
    console.log('🔒 Creating invariant token values...');
    const invariantTokenValueInserts = data.invariantTokenValues.map(tv => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      value: tv.value,
      type: tv.type,
      componentId: componentIdMap.get(tv.componentId),
      designSystemId: designSystemIdMap.get(tv.designSystemId)
    }));
    await db.insert(schema.tokenValues).values(invariantTokenValueInserts);
    console.log(`✅ Created ${invariantTokenValueInserts.length} invariant token values`);

    console.log('\n✅ Seed from current state completed successfully!');
    console.log('📊 Summary:');
    console.log(`  • ${insertedDesignSystems.length} Design Systems`);
    console.log(`  • ${insertedComponents.length} Components`);
    console.log(`  • ${insertedVariations.length} Variations`);
    console.log(`  • ${insertedTokens.length} Tokens`);
    console.log(`  • ${tokenVariationInserts.length} Token-Variation Assignments`);
    console.log(`  • ${designSystemComponentInserts.length} Design System-Component Relationships`);
    console.log(`  • ${propsAPIInserts.length} Props API Entries`);
    console.log(`  • ${insertedVariationValues.length} Variation Values`);
    console.log(`  • ${variationTokenValueInserts.length} Variation Token Values`);
    console.log(`  • ${invariantTokenValueInserts.length} Invariant Token Values`);

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
if (require.main === module) {
  seedFromCurrentState().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export { seedFromCurrentState, extractCurrentState };
