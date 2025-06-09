#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { ApiClient } from './api-client';
import { ConfigGenerator } from './generator';

const program = new Command();

program
  .name('generate-ds')
  .description('Generate design system component configurations from API')
  .version('1.0.0');

program
  .argument('<design-system-id>', 'Design system ID to generate from')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-u, --url <url>', 'API base URL', 'http://localhost:3001')
  .option('--dry-run', 'Show what would be generated without creating files')
  .action(async (designSystemId: string, options) => {
    try {
      const id = parseInt(designSystemId);
      if (isNaN(id)) {
        console.error('❌ Design system ID must be a number');
        process.exit(1);
      }

      console.log(`🚀 Generating design system components...`);
      console.log(`   ID: ${id}`);
      console.log(`   Output: ${path.resolve(options.output)}`);
      console.log(`   API URL: ${options.url}`);
      
      if (options.dryRun) {
        console.log(`   Mode: DRY RUN (no files will be created)`);
      }

      // Initialize API client
      const apiClient = new ApiClient(options.url);

      // Check API connection
      console.log('\n🔌 Checking API connection...');
      const isConnected = await apiClient.checkConnection();
      if (!isConnected) {
        console.error(`❌ Cannot connect to API at ${options.url}`);
        console.error('   Make sure the backend server is running');
        process.exit(1);
      }
      console.log('✅ API connection successful');

      // Fetch design system data
      console.log(`\n📥 Fetching design system data...`);
      const designSystem = await apiClient.getDesignSystem(id);
      
      console.log(`✅ Found design system: "${designSystem.name}"`);
      console.log(`   Components: ${designSystem.components.length}`);
      console.log(`   Variation Values: ${designSystem.variationValues.length}`);

      if (designSystem.components.length === 0) {
        console.warn('⚠️  No components found in this design system');
        return;
      }

      // Show what will be generated
      console.log('\n📦 Components to generate:');
      designSystem.components.forEach(comp => {
        const componentVariationValues = designSystem.variationValues.filter(
          vv => vv.componentId === comp.component.id
        );
        console.log(`   • ${comp.component.name} (${componentVariationValues.length} variation values)`);
      });

      if (options.dryRun) {
        console.log('\n🔍 DRY RUN completed - no files were created');
        return;
      }

      // Generate configuration files
      console.log('\n🔧 Generating configuration files...');
      const generator = new ConfigGenerator(options.output);
      await generator.generateDesignSystem(designSystem);

      console.log('\n🎉 Generation completed successfully!');
      console.log(`📁 Files created in: ${path.resolve(options.output)}`);

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(); 