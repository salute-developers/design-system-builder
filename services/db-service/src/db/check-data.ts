import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function checkData() {
  console.log('🔍 Checking database data...');

  try {
    // Check design systems
    const designSystems = await db.query.designSystems.findMany();
    console.log('\n📊 Design Systems:');
    designSystems.forEach(ds => {
      console.log(`  - ${ds.id}: ${ds.name}`);
    });

    // Check components
    const components = await db.query.components.findMany();
    console.log('\n🔧 Components:');
    components.forEach(comp => {
      console.log(`  - ${comp.id}: ${comp.name}`);
    });

    // Check variations for Link component
    const linkComponent = components.find(c => c.name === 'Link');
    if (linkComponent) {
      const variations = await db.query.variations.findMany({
        where: (variations, { eq }) => eq(variations.componentId, linkComponent.id)
      });
      console.log('\n🎨 Link Variations:');
      variations.forEach(variation => {
        console.log(`  - ${variation.id}: ${variation.name} (component: ${variation.componentId})`);
      });
    }

    // Check variation values
    const variationValues = await db.query.variationValues.findMany();
    console.log('\n📝 Variation Values:');
    variationValues.forEach(vv => {
      console.log(`  - ${vv.id}: ${vv.name} (design_system: ${vv.designSystemId}, component: ${vv.componentId}, variation: ${vv.variationId})`);
    });

    // Check design system components
    const dsComponents = await db.query.designSystemComponents.findMany();
    console.log('\n🔗 Design System Components:');
    dsComponents.forEach(dsc => {
      console.log(`  - ${dsc.id}: design_system=${dsc.designSystemId}, component=${dsc.componentId}`);
    });

    // Check the Plasma Design System specifically
    const plasmaDS = designSystems.find(ds => ds.name === 'Plasma Design System');
    if (plasmaDS) {
      console.log(`\n🔍 Checking Plasma Design System (ID: ${plasmaDS.id}) details...`);

      const fullDS = await db.query.designSystems.findFirst({
        where: (ds, { eq }) => eq(ds.id, plasmaDS.id),
        with: {
          components: {
            with: {
              component: {
                with: {
                  variations: true
                }
              }
            }
          },
          variationValues: true
        }
      });

      console.log('  Components:', fullDS?.components?.length || 0);
      console.log('  Variation Values:', fullDS?.variationValues?.length || 0);

      if (fullDS?.components) {
        fullDS.components.forEach(comp => {
          console.log(`    Component: ${comp.component.name} (variations: ${comp.component.variations?.length || 0})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error checking data:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the check function
if (require.main === module) {
  checkData().catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
}

export default checkData;
