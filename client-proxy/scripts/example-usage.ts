import { BackendDataFetcher } from './fetch-backend-data';
import { Config } from './config';

// Example 1: Basic usage with default configuration
async function basicExample() {
  console.log('🔧 Example 1: Basic usage');
  const fetcher = new BackendDataFetcher();
  await fetcher.run();
}

// Example 2: Custom configuration
async function customConfigExample() {
  console.log('🔧 Example 2: Custom configuration');
  
  const customConfig: Partial<Config> = {
    backend: {
      baseUrl: 'http://localhost:3001',
      timeout: 60000, // 60 seconds
    },
    output: {
      directory: 'custom-data',
      saveTimestamped: true,
      saveLatest: true,
      saveSummary: true,
    }
  };
  
  const fetcher = new BackendDataFetcher(customConfig);
  await fetcher.run();
}

// Example 3: Fetch data without saving (for processing)
async function fetchOnlyExample() {
  console.log('🔧 Example 3: Fetch data without saving');
  
  const fetcher = new BackendDataFetcher();
  const data = await fetcher.fetchAllData();
  
  console.log('📊 Fetched data summary:');
  console.log(`- Components: ${data.components.length}`);
  console.log(`- Design Systems: ${data.designSystems.length}`);
  console.log(`- Variation Values: ${data.variationValues.length}`);
  
  // Process the data as needed
  // For example, find components with specific names
  const linkComponents = data.components.filter(c => c.name.toLowerCase().includes('link'));
  console.log(`🔗 Found ${linkComponents.length} link-related components`);
  
  return data;
}

// Example 4: Environment-based configuration
async function environmentExample() {
  console.log('🔧 Example 4: Environment-based configuration');
  
  // Set environment variables
  process.env.BACKEND_BASE_URL = 'http://localhost:3001';
  process.env.BACKEND_TIMEOUT = '45000';
  
  const fetcher = new BackendDataFetcher();
  await fetcher.run();
}

// Main function to run examples
async function runExamples() {
  try {
    console.log('🚀 Running BackendDataFetcher examples...\n');
    
    // Uncomment the examples you want to run
    // await basicExample();
    // await customConfigExample();
    // await fetchOnlyExample();
    // await environmentExample();
    
    console.log('\n✨ Examples completed!');
    
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Run examples if called directly
if (require.main === module) {
  runExamples();
}

export {
  basicExample,
  customConfigExample,
  fetchOnlyExample,
  environmentExample,
  runExamples
};
