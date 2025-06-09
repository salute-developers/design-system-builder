import * as fs from 'fs-extra';
import * as path from 'path';
import { DesignSystem, ComponentConfig, VariationValue } from './types';

export class ConfigGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generateDesignSystem(designSystem: DesignSystem): Promise<void> {
    console.log(`🎨 Generating design system: ${designSystem.name}`);
    
    // Create base directory structure
    const dsDir = path.join(this.outputDir, 'design-system', 'src', 'components');
    await fs.ensureDir(dsDir);

    // Generate config for each component
    for (const dsComponent of designSystem.components) {
      await this.generateComponentConfig(dsComponent.component, designSystem.variationValues, dsDir);
    }

    console.log(`✅ Generated ${designSystem.components.length} component configurations`);
  }

  private async generateComponentConfig(
    component: any,
    allVariationValues: VariationValue[],
    baseDir: string
  ): Promise<void> {
    const componentName = component.name;
    console.log(`  📦 Generating ${componentName} configuration...`);

    // Filter variation values for this component
    const componentVariationValues = allVariationValues.filter(
      vv => vv.componentId === component.id
    );

    // Build the configuration object
    const config = this.buildComponentConfig(component, componentVariationValues);

    // Generate TypeScript config file
    const configContent = this.generateConfigFileContent(componentName, config);

    // Create component directory and write file
    const componentDir = path.join(baseDir, componentName);
    await fs.ensureDir(componentDir);
    
    const configFilePath = path.join(componentDir, `${componentName}.config.ts`);
    await fs.writeFile(configFilePath, configContent, 'utf8');

    console.log(`    ✅ Created ${componentName}.config.ts`);
  }

  private buildComponentConfig(component: any, variationValues: VariationValue[]): ComponentConfig {
    const config: ComponentConfig = {
      defaults: {},
      variations: {}
    };

    // Group variation values by variation name
    const variationGroups: Record<string, VariationValue[]> = {};
    
    for (const vv of variationValues) {
      const variation = component.variations.find((v: any) => v.id === vv.variationId);
      if (variation) {
        if (!variationGroups[variation.name]) {
          variationGroups[variation.name] = [];
        }
        variationGroups[variation.name].push(vv);
      }
    }

    // Build variations object
    for (const [variationName, values] of Object.entries(variationGroups)) {
      config.variations[variationName] = {};
      
      for (const vv of values) {
        // Build CSS-like string from token values
        const cssTokens: string[] = [];
        
        for (const tokenValue of vv.tokenValues) {
          const tokenName = tokenValue.token.name;
          const value = tokenValue.value;
          cssTokens.push(`                \${tokens.${tokenName}}: ${value};`);
        }

        const cssString = cssTokens.length > 0 
          ? `css\`\n${cssTokens.join('\n')}\n            \``
          : `css\`\``;

        config.variations[variationName][vv.name] = cssString;
      }

      // Set default value for this variation (use first value as default)
      if (values.length > 0) {
        config.defaults[variationName] = values[0].name;
      }
    }

    return config;
  }

  private generateConfigFileContent(componentName: string, config: ComponentConfig): string {
    const componentNameLower = componentName.toLowerCase();
    
    return `import { css, ${componentNameLower}Tokens as tokens } from '@salutejs/plasma-new-hope/styled-components';

export const config = {
    defaults: ${JSON.stringify(config.defaults, null, 8).replace(/"/g, "'")},
    variations: {
${this.formatVariations(config.variations)}
    },
};
`;
  }

  private formatVariations(variations: Record<string, Record<string, string>>): string {
    const formatted: string[] = [];
    
    for (const [variationName, values] of Object.entries(variations)) {
      const formattedValues: string[] = [];
      
      for (const [valueName, cssString] of Object.entries(values)) {
        formattedValues.push(`            ${valueName}: ${cssString},`);
      }
      
      formatted.push(`        ${variationName}: {
${formattedValues.join('\n')}
        },`);
    }
    
    return formatted.join('\n');
  }
} 