import { FormatTransformer } from './format-transformer';
import * as fs from 'fs-extra';
import * as path from 'path';

async function testTransformation() {
  console.log('🧪 Testing Format Transformation...\n');

  try {
    // Load the backend data
    const backendDataPath = path.join(__dirname, '..', 'data', 'latest-test-x.json');
    const backendData = await fs.readJson(backendDataPath);
    console.log('✅ Loaded backend data');

    // Load the client data
    const clientDataPath = path.join(__dirname, '..', 'storage', 'design-systems', 'test@0.1.0.components.json');
    const clientData = await fs.readJson(clientDataPath);
    console.log('✅ Loaded client data');

    const transformer = new FormatTransformer();

    // Test Backend → Client transformation
    console.log('\n🔄 Testing Backend → Client transformation...');
    const backendToClient = transformer.transformBackendToClient(backendData);
    
    // Validate the transformation
    const validation1 = transformer.validateTransformation(backendData, backendToClient, 'toClient');
    console.log('📊 Validation Results:');
    console.log(`   Valid: ${validation1.isValid}`);
    console.log(`   Warnings: ${validation1.warnings.length}`);
    console.log(`   Data Loss: ${validation1.dataLoss.length}`);
    
    if (validation1.warnings.length > 0) {
      console.log('   ⚠️  Warnings:', validation1.warnings);
    }
    if (validation1.dataLoss.length > 0) {
      console.log('   ❌ Data Loss:', validation1.dataLoss);
    }

    // Test Client → Backend transformation
    console.log('\n🔄 Testing Client → Backend transformation...');
    const clientToBackend = transformer.transformClientToBackend(clientData);
    
    // Validate the transformation
    const validation2 = transformer.validateTransformation(clientData, clientToBackend, 'toBackend');
    console.log('📊 Validation Results:');
    console.log(`   Valid: ${validation2.isValid}`);
    console.log(`   Warnings: ${validation2.warnings.length}`);
    console.log(`   Data Loss: ${validation2.dataLoss.length}`);
    
    if (validation2.warnings.length > 0) {
      console.log('   ⚠️  Warnings:', validation2.warnings);
    }
    if (validation2.dataLoss.length > 0) {
      console.log('   ❌ Data Loss:', validation2.dataLoss);
    }

    // Test round-trip transformation
    console.log('\n🔄 Testing round-trip transformation (Backend → Client → Backend)...');
    const roundTrip = transformer.transformClientToBackend(backendToClient);
    
    // Compare original with round-trip
    const originalComponentCount = backendData.components.length;
    const roundTripComponentCount = roundTrip.components.length;
    const originalTokenCount = backendData.components.reduce((sum: number, c: any) => sum + c.tokens.length, 0);
    const roundTripTokenCount = roundTrip.components.reduce((sum: number, c: any) => sum + c.tokens.length, 0);

    console.log('📊 Round-trip Comparison:');
    console.log(`   Components: ${originalComponentCount} → ${roundTripComponentCount}`);
    console.log(`   Tokens: ${originalTokenCount} → ${roundTripTokenCount}`);

    // Save transformed data for inspection
    const outputDir = path.join(__dirname, '..', 'data', 'transformed');
    await fs.ensureDir(outputDir);

    await fs.writeJson(
      path.join(outputDir, 'backend-to-client.json'),
      backendToClient,
      { spaces: 2 }
    );
    console.log('💾 Saved backend-to-client transformation');

    await fs.writeJson(
      path.join(outputDir, 'client-to-backend.json'),
      clientToBackend,
      { spaces: 2 }
    );
    console.log('💾 Saved client-to-backend transformation');

    await fs.writeJson(
      path.join(outputDir, 'round-trip.json'),
      roundTrip,
      { spaces: 2 }
    );
    console.log('💾 Saved round-trip transformation');

    console.log('\n🎉 Transformation testing completed!');
    console.log('📁 Check the "data/transformed/" directory for results');

  } catch (error) {
    console.error('❌ Error during transformation testing:', error);
  }
}

// Run the test if called directly
if (require.main === module) {
  testTransformation();
}

export { testTransformation };
