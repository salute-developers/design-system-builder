import axios, { AxiosInstance } from 'axios';
import { allComponentsData } from './all-components-data';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Extracted data from components
const extractedData = allComponentsData;

async function seedViaAPI() {
  console.log('🌱 Starting database seed via API...');
  console.log(`📡 API Base URL: ${API_BASE_URL}`);

  try {
    // Check health endpoint first
    console.log('🔍 Checking API health...');
    const healthCheck = await api.get('/health');
    console.log('✅ API is healthy:', healthCheck.data);

    // Step 1: Create Design Systems
    console.log('\n📊 Creating design systems...');
    const designSystemIdMap = new Map<number, number>();
    
    for (const ds of extractedData.designSystems) {
      const response = await api.post('/api/design-systems', {
        name: ds.name,
        description: ds.description
      });
      designSystemIdMap.set(ds.id, response.data.id);
      console.log(`  ✅ Created design system: ${ds.name} (old ID: ${ds.id}, new ID: ${response.data.id})`);
    }

    // Step 2: Create Components
    console.log('\n🔧 Creating components...');
    const componentIdMap = new Map<number, number>();
    
    for (const component of extractedData.components) {
      const response = await api.post('/admin-api/components', {
        name: component.name,
        description: component.description
      });
      componentIdMap.set(component.id, response.data.id);
      console.log(`  ✅ Created component: ${component.name} (old ID: ${component.id}, new ID: ${response.data.id})`);
    }

    // Step 3: Link Components to Design Systems
    console.log('\n🔗 Linking components to design systems...');
    for (const dsc of extractedData.designSystemComponents) {
      const newDesignSystemId = designSystemIdMap.get(dsc.designSystemId);
      const newComponentId = componentIdMap.get(dsc.componentId);
      
      if (newDesignSystemId && newComponentId) {
        await api.post('/api/design-systems/components', {
          designSystemId: newDesignSystemId,
          componentId: newComponentId
        });
        console.log(`  ✅ Linked component ${newComponentId} to design system ${newDesignSystemId}`);
      }
    }

    // Step 4: Create Variations
    console.log('\n🎨 Creating variations...');
    const variationIdMap = new Map<number, number>();
    
    for (const variation of extractedData.variations) {
      const newComponentId = componentIdMap.get(variation.componentId);
      
      if (newComponentId) {
        const response = await api.post('/admin-api/variations', {
          name: variation.name,
          description: variation.description,
          componentId: newComponentId
        });
        variationIdMap.set(variation.id, response.data.id);
        console.log(`  ✅ Created variation: ${variation.name} (old ID: ${variation.id}, new ID: ${response.data.id})`);
      }
    }

    // Step 5: Create Tokens
    console.log('\n🎯 Creating tokens...');
    const tokenIdMap = new Map<number, number>();
    
    for (const token of extractedData.tokens) {
      const newComponentId = componentIdMap.get(token.componentId);
      
      if (newComponentId) {
        const response = await api.post('/admin-api/tokens', {
          name: token.name,
          description: token.description,
          type: token.type,
          defaultValue: token.defaultValue,
          componentId: newComponentId,
          xmlParam: token.xmlParam,
          composeParam: token.composeParam,
          iosParam: token.iosParam,
          webParam: token.webParam
        });
        tokenIdMap.set(token.id, response.data.id);
        console.log(`  ✅ Created token: ${token.name} (old ID: ${token.id}, new ID: ${response.data.id})`);
      }
    }

    // Step 6: Assign Tokens to Variations
    console.log('\n🔗 Assigning tokens to variations...');
    let tokenVariationCount = 0;
    
    for (const tv of extractedData.tokenVariations) {
      const newTokenId = tokenIdMap.get(tv.tokenId);
      const newVariationId = variationIdMap.get(tv.variationId);
      
      if (newTokenId && newVariationId) {
        try {
          await api.post(`/admin-api/tokens/${newTokenId}/variations/${newVariationId}`);
          tokenVariationCount++;
          console.log(`  ✅ Assigned token ${newTokenId} to variation ${newVariationId}`);
        } catch (error: any) {
          if (error.response?.status === 400 && error.response?.data?.error?.includes('already assigned')) {
            console.log(`  ⚠️  Token ${newTokenId} already assigned to variation ${newVariationId}`);
          } else {
            throw error;
          }
        }
      }
    }

    // Step 7: Create Props API
    console.log('\n⚙️  Creating props API entries...');
    let propsAPICount = 0;
    
    for (const prop of extractedData.propsAPI) {
      const newComponentId = componentIdMap.get(prop.componentId);
      
      if (newComponentId) {
        try {
          await api.post('/admin-api/props-api', {
            componentId: newComponentId,
            name: prop.name,
            value: prop.defaultValue || 'false'
          });
          propsAPICount++;
          console.log(`  ✅ Created props API: ${prop.name} for component ${newComponentId}`);
        } catch (error: any) {
          if (error.response?.status === 400) {
            console.log(`  ⚠️  Props API ${prop.name} already exists for component ${newComponentId}`);
          } else {
            throw error;
          }
        }
      }
    }

    // Step 8: Create Variation Values with Token Values
    console.log('\n📝 Creating variation values...');
    const variationValueIdMap = new Map<number, number>();
    
    // Build helper maps
    const tokenIdToComponentId = new Map<number, number>();
    extractedData.tokens.forEach(t => tokenIdToComponentId.set(t.id, t.componentId));

    const variationIdToComponentId = new Map<number, number>();
    extractedData.variations.forEach(v => variationIdToComponentId.set(v.id, v.componentId));

    const variationValueIdToComponentId = new Map<number, number>();
    extractedData.variationValues.forEach(vv => {
      const parentComponentId = variationIdToComponentId.get(vv.variationId);
      if (parentComponentId !== undefined) {
        variationValueIdToComponentId.set(vv.id, parentComponentId);
      }
    });

    for (const vv of extractedData.variationValues) {
      const newDesignSystemId = designSystemIdMap.get(1); // All variation values belong to design system 1
      const parentVariation = extractedData.variations.find(v => v.id === vv.variationId);
      const parentComponentId = parentVariation ? parentVariation.componentId : undefined;
      const newComponentId = parentComponentId !== undefined ? componentIdMap.get(parentComponentId) : undefined;
      const newVariationId = variationIdMap.get(vv.variationId);
      const isDefault = (vv as any).isDefaultValue ? true : false;

      if (newDesignSystemId && newVariationId) {
        // Get token values for this variation value
        const tokenValuesForVV = extractedData.tokenValues
          .filter(tv => tv.variationValueId === vv.id)
          .filter(tv => {
            const tokenComponentId = tokenIdToComponentId.get(tv.tokenId);
            const vvComponentId = variationValueIdToComponentId.get(vv.id);
            return tokenComponentId !== undefined && vvComponentId !== undefined && tokenComponentId === vvComponentId;
          })
          .map(tv => {
            const newTokenId = tokenIdMap.get(tv.tokenId);
            return newTokenId ? {
              tokenId: newTokenId,
              value: tv.value,
              states: (tv as any).states || undefined
            } : null;
          })
          .filter(tv => tv !== null);

        const response = await api.post('/api/variation-values', {
          designSystemId: newDesignSystemId,
          componentId: newComponentId,
          variationId: newVariationId,
          name: vv.value,
          description: vv.description,
          isDefaultValue: isDefault,
          tokenValues: tokenValuesForVV
        });
        
        variationValueIdMap.set(vv.id, response.data.id);
        console.log(`  ✅ Created variation value: ${vv.value} (old ID: ${vv.id}, new ID: ${response.data.id}) with ${tokenValuesForVV.length} token values`);
      }
    }

    // Step 9: Create Invariant Token Values
    console.log('\n🔒 Creating invariant token values...');
    
    // Group invariant token values by component and design system
    const invariantsByComponentAndDS = new Map<string, any[]>();
    
    for (const tv of extractedData.invariantTokenValues) {
      const newComponentId = componentIdMap.get(tv.componentId);
      const newDesignSystemId = designSystemIdMap.get(tv.designSystemId);
      const newTokenId = tokenIdMap.get(tv.tokenId);
      
      if (newComponentId && newDesignSystemId && newTokenId) {
        const key = `${newComponentId}-${newDesignSystemId}`;
        if (!invariantsByComponentAndDS.has(key)) {
          invariantsByComponentAndDS.set(key, []);
        }
        invariantsByComponentAndDS.get(key)!.push({
          tokenId: newTokenId,
          value: tv.value
        });
      }
    }

    // Create invariant token values grouped by component
    let invariantCount = 0;
    const invariantEntries = Array.from(invariantsByComponentAndDS.entries());
    for (const [key, tokenValues] of invariantEntries) {
      const [componentId, designSystemId] = key.split('-').map(Number);
      
      try {
        await api.post(`/api/components/${componentId}/invariants?designSystemId=${designSystemId}`, {
          tokenValues: tokenValues
        });
        invariantCount += tokenValues.length;
        console.log(`  ✅ Created ${tokenValues.length} invariant token values for component ${componentId} in design system ${designSystemId}`);
      } catch (error: any) {
        console.error(`  ❌ Error creating invariant token values for component ${componentId}:`, error.response?.data || error.message);
      }
    }

    // Summary
    console.log('\n✅ Seed via API completed successfully!');
    console.log('📊 Summary:');
    console.log(`  • ${designSystemIdMap.size} Design Systems`);
    console.log(`  • ${componentIdMap.size} Components`);
    console.log(`  • ${extractedData.designSystemComponents.length} Design System-Component Relationships`);
    console.log(`  • ${variationIdMap.size} Variations`);
    console.log(`  • ${tokenIdMap.size} Tokens`);
    console.log(`  • ${tokenVariationCount} Token-Variation Assignments`);
    console.log(`  • ${propsAPICount} Props API Entries`);
    console.log(`  • ${variationValueIdMap.size} Variation Values`);
    console.log(`  • ${invariantCount} Invariant Token Values`);

  } catch (error: any) {
    console.error('\n❌ Error during seed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Run the seed function
if (require.main === module) {
  seedViaAPI().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export { seedViaAPI };

