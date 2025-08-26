import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { loadConfig, Config } from './config';

interface BackendData {
  timestamp: string;
  components: any[];
  designSystems: any[];
  variationValues: any[];
  metadata: {
    totalComponents: number;
    totalDesignSystems: number;
    totalVariationValues: number;
    apiBaseUrl: string;
  };
}

class BackendDataFetcher {
  private config: Config;
  private outputDir: string;

  constructor(config?: Partial<Config>) {
    this.config = { ...loadConfig(), ...config };
    this.outputDir = path.join(__dirname, '..', this.config.output.directory);
  }

  async fetchAllData(): Promise<BackendData> {
    console.log('🚀 Starting to fetch all backend data...');
    
    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);

      // Fetch data from all endpoints
      const [components, designSystems, variationValues] = await Promise.all([
        this.fetchComponents(),
        this.fetchDesignSystems(),
        this.fetchVariationValues()
      ]);

      const data: BackendData = {
        timestamp: new Date().toISOString(),
        components,
        designSystems,
        variationValues,
        metadata: {
          totalComponents: components.length,
          totalDesignSystems: designSystems.length,
          totalVariationValues: variationValues.length,
          apiBaseUrl: this.config.backend.baseUrl
        }
      };

      return data;
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      throw error;
    }
  }

  private async fetchComponents(): Promise<any[]> {
    try {
      console.log('📦 Fetching components...');
      const response = await axios.get(`${this.config.backend.baseUrl}${this.config.endpoints.components}`, {
        timeout: this.config.backend.timeout
      });
      console.log(`✅ Fetched ${response.data.length} components`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching components:', error);
      return [];
    }
  }

  private async fetchDesignSystems(): Promise<any[]> {
    try {
      console.log('🎨 Fetching design systems...');
      const response = await axios.get(`${this.config.backend.baseUrl}${this.config.endpoints.designSystems}`, {
        timeout: this.config.backend.timeout
      });
      console.log(`✅ Fetched ${response.data.length} design systems`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching design systems:', error);
      return [];
    }
  }

  private async fetchVariationValues(): Promise<any[]> {
    try {
      console.log('🔄 Fetching variation values...');
      const response = await axios.get(`${this.config.backend.baseUrl}${this.config.endpoints.variationValues}`, {
        timeout: this.config.backend.timeout
      });
      console.log(`✅ Fetched ${response.data.length} variation values`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching variation values:', error);
      return [];
    }
  }

  async saveData(data: BackendData): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backend-data-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    try {
      await fs.writeJson(filepath, data, { spaces: 2 });
      console.log(`💾 Data saved to: ${filepath}`);

      // Also save a latest version
      const latestFilepath = path.join(this.outputDir, 'latest-backend-data.json');
      await fs.writeJson(latestFilepath, data, { spaces: 2 });
      console.log(`💾 Latest data saved to: ${latestFilepath}`);

      // Save summary
      const summary = {
        timestamp: data.timestamp,
        metadata: data.metadata,
        filepath: filepath,
        latestFilepath: latestFilepath
      };
      
      const summaryFilepath = path.join(this.outputDir, 'fetch-summary.json');
      await fs.writeJson(summaryFilepath, summary, { spaces: 2 });
      console.log(`📋 Summary saved to: ${summaryFilepath}`);

    } catch (error) {
      console.error('❌ Error saving data:', error);
      throw error;
    }
  }

  async run(): Promise<void> {
    try {
      console.log(`🌐 Fetching data from: ${this.config.backend.baseUrl}`);
      console.log(`📁 Output directory: ${this.outputDir}`);
      
      const data = await this.fetchAllData();
      await this.saveData(data);
      
      console.log('\n🎉 Data fetching completed successfully!');
      console.log(`📊 Total components: ${data.metadata.totalComponents}`);
      console.log(`📊 Total design systems: ${data.metadata.totalDesignSystems}`);
      console.log(`📊 Total variation values: ${data.metadata.totalVariationValues}`);
      
    } catch (error) {
      console.error('💥 Script failed:', error);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const fetcher = new BackendDataFetcher();
  fetcher.run();
}

export { BackendDataFetcher };
