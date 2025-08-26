import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadConfig, Config } from './config';

interface DesignSystemData {
  timestamp: string;
  designSystem: any;
  components: any[];
  variationValues: any[];
  tokenValues: any[];
  metadata: {
    designSystemId: number;
    designSystemName: string;
    totalComponents: number;
    totalVariations: number;
    totalVariationValues: number;
    totalTokens: number;
    totalTokenValues: number;
    totalPropsAPI: number;
    apiBaseUrl: string;
  };
}

class DesignSystemFetcher {
  private config: Config;
  private outputDir: string;

  constructor(config?: Partial<Config>) {
    this.config = { ...loadConfig(), ...config };
    this.outputDir = path.join(__dirname, '..', this.config.output.directory);
  }

  async fetchDesignSystem(designSystemId: number): Promise<DesignSystemData> {
    console.log(`🚀 Starting to fetch design system ID: ${designSystemId}...`);
    
    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);

      // Fetch the design system with all its related data
      const designSystem = await this.fetchDesignSystemWithRelations(designSystemId);
      
      if (!designSystem) {
        throw new Error(`Design system with ID ${designSystemId} not found`);
      }

      // Extract components from the design system
      const components = designSystem.components?.map((dsComp: any) => dsComp.component) || [];
      
      // Collect all unique tokens and props API from components
      const allTokens = new Map();
      const allPropsAPI = new Map();
      const allVariations = new Map();
      const allVariationValues = new Map();
      const allTokenValues = new Map();

      // Process each component
      for (const component of components) {
        // Collect tokens
        if (component.tokens) {
          for (const token of component.tokens) {
            allTokens.set(token.id, token);
          }
        }

        // Collect props API
        if (component.propsAPI) {
          for (const prop of component.propsAPI) {
            allPropsAPI.set(prop.id, prop);
          }
        }

        // Collect variations
        if (component.variations) {
          for (const variation of component.variations) {
            allVariations.set(variation.id, variation);
            
            // Collect tokens from token variations
            if (variation.tokenVariations) {
              for (const tokenVar of variation.tokenVariations) {
                if (tokenVar.token) {
                  allTokens.set(tokenVar.token.id, tokenVar.token);
                }
              }
            }
          }
        }
      }

      // Collect variation values and token values for this design system
      if (designSystem.variationValues) {
        for (const variationValue of designSystem.variationValues) {
          allVariationValues.set(variationValue.id, variationValue);
          
          // Collect token values
          if (variationValue.tokenValues) {
            for (const tokenValue of variationValue.tokenValues) {
              allTokenValues.set(tokenValue.id, tokenValue);
            }
          }
        }
      }

      const data: DesignSystemData = {
        timestamp: new Date().toISOString(),
        designSystem: {
          id: designSystem.id,
          name: designSystem.name,
          description: designSystem.description,
          createdAt: designSystem.createdAt,
          updatedAt: designSystem.updatedAt
        },
        components: components.map((component: any) => ({
          ...component,
          variations: Array.from(allVariations.values()).filter(v => v.componentId === component.id),
          propsAPI: Array.from(allPropsAPI.values()).filter(p => p.componentId === component.id)
        })),
        variationValues: Array.from(allVariationValues.values()),
        tokenValues: Array.from(allTokenValues.values()),
        metadata: {
          designSystemId: designSystem.id,
          designSystemName: designSystem.name,
          totalComponents: components.length,
          totalVariations: allVariations.size,
          totalVariationValues: allVariationValues.size,
          totalTokens: allTokens.size,
          totalTokenValues: allTokenValues.size,
          totalPropsAPI: allPropsAPI.size,
          apiBaseUrl: this.config.backend.baseUrl
        }
      };

      return data;
    } catch (error) {
      console.error('❌ Error fetching design system data:', error);
      throw error;
    }
  }

  private async fetchDesignSystemWithRelations(designSystemId: number): Promise<any> {
    try {
      console.log(`🎨 Fetching design system ${designSystemId} with all relations...`);
      
      const response = await axios.get(
        `${this.config.backend.baseUrl}/api/design-systems/${designSystemId}`,
        { timeout: this.config.backend.timeout }
      );
      
      console.log(`✅ Fetched design system: ${response.data.name}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching design system ${designSystemId}:`, error);
      throw error;
    }
  }

  async saveData(data: DesignSystemData): Promise<void> {
    const designSystemName = data.designSystem.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const filename = `design-system-${designSystemName}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    try {
      await fs.writeJson(filepath, data, { spaces: 2 });
      console.log(`💾 Design system data saved to: ${filepath}`);

      // Also save a latest version for this design system
      const latestFilepath = path.join(this.outputDir, `latest-${designSystemName}.json`);
      await fs.writeJson(latestFilepath, data, { spaces: 2 });
      console.log(`💾 Latest ${designSystemName} data saved to: ${latestFilepath}`);

      // Save summary
      const summary = {
        timestamp: data.timestamp,
        designSystemId: data.metadata.designSystemId,
        designSystemName: data.metadata.designSystemName,
        metadata: data.metadata,
        filepath: filepath,
        latestFilepath: latestFilepath
      };
      
      const summaryFilepath = path.join(this.outputDir, `fetch-summary-${designSystemName}.json`);
      await fs.writeJson(summaryFilepath, summary, { spaces: 2 });
      console.log(`📋 Summary saved to: ${summaryFilepath}`);

    } catch (error) {
      console.error('❌ Error saving data:', error);
      throw error;
    }
  }

  async run(designSystemId: number): Promise<void> {
    try {
      console.log(`🌐 Fetching design system data from: ${this.config.backend.baseUrl}`);
      console.log(`📁 Output directory: ${this.outputDir}`);
      console.log(`🎯 Target design system ID: ${designSystemId}`);
      
      const data = await this.fetchDesignSystem(designSystemId);
      await this.saveData(data);
      
      console.log('\n🎉 Design system data fetching completed successfully!');
      console.log(`📊 Design System: ${data.metadata.designSystemName} (ID: ${data.metadata.designSystemId})`);
      console.log(`📊 Total components: ${data.metadata.totalComponents}`);
      console.log(`📊 Total variations: ${data.metadata.totalVariations}`);
      console.log(`📊 Total variation values: ${data.metadata.totalVariationValues}`);
      console.log(`📊 Total tokens: ${data.metadata.totalTokens}`);
      console.log(`📊 Total token values: ${data.metadata.totalTokenValues}`);
      console.log(`📊 Total props API: ${data.metadata.totalPropsAPI}`);
      
    } catch (error) {
      console.error('💥 Script failed:', error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArgs(): { designSystemId: number } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: npm run fetch-design-system <design-system-id>');
    console.error('Example: npm run fetch-design-system 26');
    process.exit(1);
  }

  const designSystemId = parseInt(args[0] || '0');
  
  if (isNaN(designSystemId) || designSystemId <= 0) {
    console.error('❌ Invalid design system ID. Must be a positive number.');
    process.exit(1);
  }

  return { designSystemId };
}

// Run the script if called directly
if (require.main === module) {
  const { designSystemId } = parseArgs();
  const fetcher = new DesignSystemFetcher();
  fetcher.run(designSystemId);
}

export { DesignSystemFetcher };
