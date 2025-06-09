import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, and } from 'drizzle-orm';

// Get database URL from environment or use default
const connectionString = `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ds_builder'}`;

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Link component configuration from user
const linkConfig = {
  defaults: {
    view: 'accent',
    focused: 'true',
  },
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
      secondary: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-secondary);
        linkColorHover: var(--text-secondary-hover);
        linkColorActive: var(--text-secondary-active);
        linkColorVisited: var(--text-secondary);
        linkColorVisitedHover: var(--text-secondary-hover);
        linkColorVisitedActive: var(--text-secondary-active);
        linkUnderlineBorder: 0;
      `,
      tertiary: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-tertiary);
        linkColorHover: var(--text-tertiary-hover);
        linkColorActive: var(--text-tertiary-active);
        linkColorVisited: var(--text-tertiary);
        linkColorVisitedHover: var(--text-tertiary-hover);
        linkColorVisitedActive: var(--text-tertiary-active);
        linkUnderlineBorder: 0;
      `,
      paragraph: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-paragraph);
        linkColorHover: var(--text-paragraph-hover);
        linkColorActive: var(--text-paragraph-active);
        linkColorVisited: var(--text-paragraph);
        linkColorVisitedHover: var(--text-paragraph-hover);
        linkColorVisitedActive: var(--text-paragraph-active);
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
      positive: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-positive);
        linkColorHover: var(--text-positive-hover);
        linkColorActive: var(--text-positive-active);
        linkColorVisited: var(--text-positive);
        linkColorVisitedHover: var(--text-positive-hover);
        linkColorVisitedActive: var(--text-positive-active);
        linkUnderlineBorder: 0;
      `,
      warning: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-warning);
        linkColorHover: var(--text-warning-hover);
        linkColorActive: var(--text-warning-active);
        linkColorVisited: var(--text-warning);
        linkColorVisitedHover: var(--text-warning-hover);
        linkColorVisitedActive: var(--text-warning-active);
        linkUnderlineBorder: 0;
      `,
      negative: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: var(--text-negative);
        linkColorHover: var(--text-negative-hover);
        linkColorActive: var(--text-negative-active);
        linkColorVisited: var(--text-negative);
        linkColorVisitedHover: var(--text-negative-hover);
        linkColorVisitedActive: var(--text-negative-active);
        linkUnderlineBorder: 0;
      `,
      clear: `
        linkFontFamily: var(--plasma-typo-text-m-font-family);
        linkColor: inherit;
        linkColorHover: inherit;
        linkColorActive: inherit;
        linkColorVisited: inherit;
        linkColorVisitedHover: inherit;
        linkColorVisitedActive: inherit;
        linkUnderlineBorder: 0.063rem;
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
};

// Function to parse CSS-like token values from string
function parseTokenValues(cssString: string): Record<string, string> {
  const tokenValues: Record<string, string> = {};
  
  // Split by lines and process each line
  const lines = cssString.trim().split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.endsWith(':')) continue;
    
    // Match pattern: tokenName: value;
    const match = trimmedLine.match(/^(\w+):\s*([^;]+);?$/);
    if (match) {
      const [, tokenName, value] = match;
      tokenValues[tokenName] = value.trim();
    }
  }
  
  return tokenValues;
}

async function seedValues() {
  console.log('🌱 Starting variation values seed...');

  try {
    // Create Design System
    console.log('📊 Creating design system...');
    const [designSystem] = await db.insert(schema.designSystems).values({
      name: 'Plasma Design System',
      description: 'Design system with Link component variations and token values'
    }).returning();

    // Get or create Link component
    console.log('🔗 Getting Link component...');
    let linkComponent = await db.query.components.findFirst({
      where: eq(schema.components.name, 'Link')
    });

    if (!linkComponent) {
      console.log('Creating Link component...');
      [linkComponent] = await db.insert(schema.components).values({
        name: 'Link',
        description: 'Clickable link component for navigation'
      }).returning();
    }

    // Connect component to design system
    console.log('🔗 Connecting component to design system...');
    await db.insert(schema.designSystemComponents).values({
      designSystemId: designSystem.id,
      componentId: linkComponent.id
    });

    // Get or create variations
    console.log('🎨 Getting/creating variations...');
    const variationsData = [
      { name: 'view', description: 'Visual appearance variation' },
      { name: 'disabled', description: 'Disabled state variation' },
      { name: 'focused', description: 'Focused state variation' }
    ];

    const variations = [];
    for (const varData of variationsData) {
      let variation = await db.query.variations.findFirst({
        where: and(
          eq(schema.variations.name, varData.name),
          eq(schema.variations.componentId, linkComponent.id)
        )
      });

      if (!variation) {
        [variation] = await db.insert(schema.variations).values({
          name: varData.name,
          description: varData.description,
          componentId: linkComponent.id
        }).returning();
      }
      variations.push(variation);
    }

    // Get all link tokens
    console.log('🎯 Getting link tokens...');
    const linkTokens = await db.query.tokens.findMany({
      where: eq(schema.tokens.componentId, linkComponent.id)
    });

    const tokenMap = linkTokens.reduce((acc, token) => {
      acc[token.name] = token;
      return acc;
    }, {} as Record<string, any>);

    // Create variation values from config
    console.log('📝 Creating variation values...');
    
    for (const [variationName, variationValues] of Object.entries(linkConfig.variations)) {
      const variation = variations.find(v => v.name === variationName);
      if (!variation) {
        console.log(`⚠️ Variation ${variationName} not found, skipping...`);
        continue;
      }

      for (const [valueName, cssString] of Object.entries(variationValues)) {
        console.log(`Creating variation value: ${variationName}.${valueName}`);
        
        // Parse token values from CSS string
        const tokenValues = parseTokenValues(cssString as string);
        
        // Create variation value
        const [variationValue] = await db.insert(schema.variationValues).values({
          designSystemId: designSystem.id,
          componentId: linkComponent.id,
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
            console.log(`⚠️ Token ${tokenName} not found, skipping...`);
          }
        }

        if (tokenValueInserts.length > 0) {
          await db.insert(schema.tokenValues).values(tokenValueInserts);
          console.log(`✅ Created ${tokenValueInserts.length} token values for ${valueName}`);
        }
      }
    }

    console.log('✅ Variation values seed completed successfully!');
    console.log(`📊 Created design system: ${designSystem.name}`);
    console.log(`🔗 Used component: ${linkComponent.name}`);
    console.log(`🎨 Created variations: ${variations.map(v => v.name).join(', ')}`);

  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
if (require.main === module) {
  seedValues().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

export default seedValues; 