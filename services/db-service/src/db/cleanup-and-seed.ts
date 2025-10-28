import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Component configurations
const componentConfigs = {
  Link: {
    variations: {
      view: {
        default: `
          linkFontFamily: var(--plasma-typo-text-m-font-family);
          linkColor: var(--text-primary);
          linkColorHover: var(--text-primary-hover);
          linkColorActive: var(--text-primary-active);
          linkColorVisited: var(--text-primary);
          linkColorVisitedHover: var(--text-primary-hover);
          linkColorVisitedActive: var(--text-primary-active);
          linkUnderlineBorder: 0;
        `,
        primary: `
          linkFontFamily: var(--plasma-typo-text-m-font-family);
          linkColor: var(--text-primary);
          linkColorHover: var(--text-primary-hover);
          linkColorActive: var(--text-primary-active);
          linkColorVisited: var(--text-primary);
          linkColorVisitedHover: var(--text-primary-hover);
          linkColorVisitedActive: var(--text-primary-active);
          linkUnderlineBorder: 0;
        `,
        accent: `
          linkFontFamily: var(--plasma-typo-text-m-font-family);
          linkColor: var(--text-accent);
          linkColorHover: var(--text-accent-hover);
          linkColorActive: var(--text-accent-active);
          linkColorVisited: var(--text-accent);
          linkColorVisitedHover: var(--text-accent-hover);
          linkColorVisitedActive: var(--text-accent-active);
          linkUnderlineBorder: 0;
        `,
      },
      disabled: {
        true: `
          linkDisabledOpacity: 0.4;
        `,
      },
      focused: {
        true: `
          linkColorFocus: var(--text-accent);
        `,
      },
    },
  },
  IconButton: {
    variations: {
      view: {
        default: `
          iconButtonColor: var(--inverse-text-primary);
          iconButtonBackgroundColor: var(--surface-solid-default);
          iconButtonLoadingBackgroundColor: var(--surface-solid-default);
          iconButtonColorHover: var(--inverse-text-primary-hover);
          iconButtonColorActive: var(--inverse-text-primary-active);
        `,
        accent: `
          iconButtonColor: var(--on-dark-text-primary);
          iconButtonBackgroundColor: var(--surface-accent);
          iconButtonLoadingBackgroundColor: var(--surface-accent);
          iconButtonBackgroundColorHover: var(--surface-accent-hover);
          iconButtonBackgroundColorActive: var(--surface-accent-active);
        `,
        secondary: `
          iconButtonColor: var(--text-primary);
          iconButtonBackgroundColor: var(--surface-transparent-secondary);
          iconButtonLoadingBackgroundColor: var(--surface-transparent-secondary);
          iconButtonBackgroundColorHover: var(--surface-transparent-secondary-hover);
          iconButtonBackgroundColorActive: var(--surface-transparent-secondary-active);
        `,
        clear: `
          iconButtonColor: var(--text-primary);
          iconButtonBackgroundColor: var(--surface-clear);
          iconButtonLoadingBackgroundColor: var(--surface-clear);
          iconButtonBackgroundColorHover: var(--surface-transparent-secondary-hover);
          iconButtonBackgroundColorActive: var(--surface-transparent-secondary-active);
        `,
      },
      size: {
        m: `
          iconButtonHeight: 3rem;
          iconButtonWidth: 3rem;
          iconButtonPadding: 1.25rem;
          iconButtonRadius: 0.75rem;
          iconButtonFontFamily: var(--plasma-typo-body-m-font-family);
          iconButtonFontSize: var(--plasma-typo-body-m-font-size);
          iconButtonFontStyle: var(--plasma-typo-body-m-font-style);
          iconButtonFontWeight: var(--plasma-typo-body-m-bold-font-weight);
          iconButtonLetterSpacing: var(--plasma-typo-body-m-letter-spacing);
          iconButtonLineHeight: var(--plasma-typo-body-m-line-height);
          iconButtonSpinnerSize: 1.375rem;
          iconButtonSpinnerColor: inherit;
        `,
        s: `
          iconButtonHeight: 2.5rem;
          iconButtonWidth: 2.5rem;
          iconButtonPadding: 1rem;
          iconButtonRadius: 0.625rem;
          iconButtonFontFamily: var(--plasma-typo-body-s-font-family);
          iconButtonFontSize: var(--plasma-typo-body-s-font-size);
          iconButtonFontStyle: var(--plasma-typo-body-s-font-style);
          iconButtonFontWeight: var(--plasma-typo-body-s-bold-font-weight);
          iconButtonLetterSpacing: var(--plasma-typo-body-s-letter-spacing);
          iconButtonLineHeight: var(--plasma-typo-body-s-line-height);
          iconButtonSpinnerSize: 1.375rem;
          iconButtonSpinnerColor: inherit;
        `,
      },
      disabled: {
        true: `
          iconButtonDisabledOpacity: 0.4;
        `,
      },
      focused: {
        true: `
          iconButtonFocusColor: var(--surface-accent);
        `,
      },
    },
  },
  Button: {
    variations: {
      view: {
        default: `
          buttonColor: var(--inverse-text-primary);
          buttonValueColor: var(--inverse-text-secondary);
          buttonBackgroundColor: var(--surface-solid-default);
          buttonLoadingBackgroundColor: var(--surface-solid-default);
          buttonColorHover: var(--inverse-text-primary-hover);
          buttonColorActive: var(--inverse-text-primary-active);
        `,
        primary: `
          buttonColor: var(--inverse-text-primary);
          buttonValueColor: var(--inverse-text-secondary);
          buttonBackgroundColor: var(--surface-solid-default);
          buttonLoadingBackgroundColor: var(--surface-solid-default);
          buttonColorHover: var(--inverse-text-primary-hover);
          buttonColorActive: var(--inverse-text-primary-active);
        `,
        accent: `
          buttonColor: var(--on-dark-text-primary);
          buttonValueColor: var(--on-dark-text-secondary);
          buttonBackgroundColor: var(--surface-accent);
          buttonLoadingBackgroundColor: var(--surface-accent);
          buttonBackgroundColorHover: var(--surface-accent-hover);
          buttonBackgroundColorActive: var(--surface-accent-active);
        `,
        secondary: `
          buttonColor: var(--text-primary);
          buttonValueColor: var(--text-secondary);
          buttonBackgroundColor: var(--surface-transparent-secondary);
          buttonLoadingBackgroundColor: var(--surface-transparent-secondary);
          buttonBackgroundColorHover: var(--surface-transparent-secondary-hover);
          buttonBackgroundColorActive: var(--surface-transparent-secondary-active);
        `,
      },
      size: {
        m: `
          buttonHeight: 3rem;
          buttonWidth: 11.25rem;
          buttonPadding: 1.25rem;
          buttonRadius: 0.75rem;
          buttonFontFamily: var(--plasma-typo-body-m-font-family);
          buttonFontSize: var(--plasma-typo-body-m-font-size);
          buttonFontStyle: var(--plasma-typo-body-m-font-style);
          buttonFontWeight: var(--plasma-typo-body-m-bold-font-weight);
          buttonLetterSpacing: var(--plasma-typo-body-m-letter-spacing);
          buttonLineHeight: var(--plasma-typo-body-m-line-height);
          buttonSpinnerSize: 1.375rem;
          buttonSpinnerColor: inherit;
          buttonLeftContentMargin: 0 0.375rem 0 -0.125rem;
          buttonRightContentMargin: 0 -0.125rem 0 0.375rem;
          buttonValueMargin: 0 0 0 0.25rem;
        `,
        s: `
          buttonHeight: 2.5rem;
          buttonWidth: 11.25rem;
          buttonPadding: 1rem;
          buttonRadius: 0.625rem;
          buttonFontFamily: var(--plasma-typo-body-s-font-family);
          buttonFontSize: var(--plasma-typo-body-s-font-size);
          buttonFontStyle: var(--plasma-typo-body-s-font-style);
          buttonFontWeight: var(--plasma-typo-body-s-bold-font-weight);
          buttonLetterSpacing: var(--plasma-typo-body-s-letter-spacing);
          buttonLineHeight: var(--plasma-typo-body-s-line-height);
          buttonSpinnerSize: 1.375rem;
          buttonSpinnerColor: inherit;
          buttonLeftContentMargin: 0 0.25rem 0 -0.125rem;
          buttonRightContentMargin: 0 -0.125rem 0 0.25rem;
          buttonValueMargin: 0 0 0 0.25rem;
        `,
      },
      disabled: {
        true: `
          buttonDisabledOpacity: 0.4;
        `,
      },
      focused: {
        true: `
          buttonFocusColor: var(--surface-accent);
        `,
      },
      stretching: {
        auto: ``,
        filled: ``,
        fixed: ``,
      },
    },
  },
};

// Function to parse token values
function parseTokenValues(cssString: string): Record<string, string> {
  const tokenValues: Record<string, string> = {};
  const lines = cssString.trim().split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.endsWith(':')) continue;
    
    const match = trimmedLine.match(/^(\w+):\s*([^;]+);?$/);
    if (match) {
      const [, tokenName, value] = match;
      tokenValues[tokenName] = value.trim();
    }
  }
  
  return tokenValues;
}

async function cleanupAndSeed() {
  console.log('🧹 Cleaning up and re-seeding with all components...');

  try {
    // Delete all Plasma Design Systems and their related data
    console.log('Deleting existing Plasma Design Systems...');
    
    const plasmaDesignSystems = await db.query.designSystems.findMany({
      where: (ds, { eq }) => eq(ds.name, 'Plasma Design System')
    });
    
    for (const ds of plasmaDesignSystems) {
      console.log(`Deleting design system ${ds.id}: ${ds.name}`);
      await db.delete(schema.variationValues).where(eq(schema.variationValues.designSystemId, ds.id));
      await db.delete(schema.designSystemComponents).where(eq(schema.designSystemComponents.designSystemId, ds.id));
      await db.delete(schema.designSystems).where(eq(schema.designSystems.id, ds.id));
    }

    // Create new Plasma Design System
    console.log('📊 Creating new Plasma Design System...');
    const [designSystem] = await db.insert(schema.designSystems).values({
      name: 'Plasma Design System',
      description: 'Design system with Link, IconButton, and Button components with variations and token values',
      projectName: "Test 66",
      grayTone: "warmGray",
      accentColor: "arctic",
      lightStrokeSaturation: 700,
      lightFillSaturation: 600,
      darkStrokeSaturation: 400,
      darkFillSaturation: 400,
    }).returning();

    // Process each component
    const componentData = [];
    
    for (const [componentName, config] of Object.entries(componentConfigs)) {
      console.log(`\n🔧 Processing ${componentName} component...`);
      
      // Get or create component
      let component = await db.query.components.findFirst({
        where: eq(schema.components.name, componentName)
      });

      if (!component) {
        console.log(`Creating ${componentName} component...`);
        [component] = await db.insert(schema.components).values({
          name: componentName,
          description: `${componentName} component for user interactions`
        }).returning();
      }

      // Connect component to design system
      await db.insert(schema.designSystemComponents).values({
        designSystemId: designSystem.id,
        componentId: component.id
      });

      // Get variation names for this component
      const variationNames = Object.keys(config.variations);
      console.log(`Creating variations: ${variationNames.join(', ')}`);

      // Create variations
      const variations = [];
      for (const variationName of variationNames) {
        let variation = await db.query.variations.findFirst({
          where: and(
            eq(schema.variations.name, variationName),
            eq(schema.variations.componentId, component.id)
          )
        });

        if (!variation) {
          [variation] = await db.insert(schema.variations).values({
            name: variationName,
            description: `${variationName} variation for ${componentName}`,
            componentId: component.id
          }).returning();
        }
        variations.push(variation);
      }

      // Get tokens for this component
      const tokens = await db.query.tokens.findMany({
        where: eq(schema.tokens.componentId, component.id)
      });

      const tokenMap = tokens.reduce((acc, token) => {
        acc[token.name] = token;
        return acc;
      }, {} as Record<string, any>);

      console.log(`Found ${tokens.length} tokens for ${componentName}`);

      // Create variation values
      let totalVariationValues = 0;
      for (const [variationName, variationValues] of Object.entries(config.variations)) {
        const variation = variations.find(v => v.name === variationName);
        if (!variation) {
          console.log(`⚠️ Variation ${variationName} not found for ${componentName}, skipping...`);
          continue;
        }

        for (const [valueName, cssString] of Object.entries(variationValues)) {
          console.log(`  Creating: ${componentName}.${variationName}.${valueName}`);
          
          const tokenValues = parseTokenValues(cssString as string);
          
          // Create variation value
          const [variationValue] = await db.insert(schema.variationValues).values({
            designSystemId: designSystem.id,
            componentId: component.id,
            variationId: variation.id,
            name: valueName,
            description: `${valueName} style for ${variationName} variation`
          }).returning();

          // Create token values
          const tokenValueInserts = [];
          for (const [tokenName, value] of Object.entries(tokenValues)) {
            const token = tokenMap[tokenName];
            if (token) {
              tokenValueInserts.push({
                variationValueId: variationValue.id,
                tokenId: token.id,
                value: value
              });
            } else {
              console.log(`    ⚠️ Token ${tokenName} not found for ${componentName}, skipping...`);
            }
          }

          if (tokenValueInserts.length > 0) {
            await db.insert(schema.tokenValues).values(tokenValueInserts);
            console.log(`    ✅ Created ${tokenValueInserts.length} token values`);
          }
          
          totalVariationValues++;
        }
      }

      componentData.push({
        name: componentName,
        id: component.id,
        variations: variations.length,
        variationValues: totalVariationValues,
        tokens: tokens.length
      });
    }

    console.log('\n✅ Cleanup and seed completed successfully!');
    console.log(`📊 Created design system: ${designSystem.name} (ID: ${designSystem.id})`);
    console.log('\n📈 Summary:');
    componentData.forEach(comp => {
      console.log(`  🔧 ${comp.name}: ${comp.variations} variations, ${comp.variationValues} values, ${comp.tokens} tokens`);
    });

  } catch (error) {
    console.error('❌ Error during cleanup and seed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the function
if (require.main === module) {
  cleanupAndSeed().catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
}

export default cleanupAndSeed; 