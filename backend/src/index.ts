import express from 'express';
import cors from 'cors';
import { components, variations, tokens, designSystems, variationValues, tokenValues, designSystemComponents } from './db/schema';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Design Systems routes
app.get('/api/design-systems', async (req, res) => {
  try {
    const allDesignSystems = await db.query.designSystems.findMany({});
    res.json(allDesignSystems);
  } catch (error) {
    console.error('Error fetching design systems:', error);
    res.status(500).json({ error: 'Failed to fetch design systems' });
  }
});

app.get('/api/design-systems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const designSystem = await db.query.designSystems.findFirst({
      where: eq(designSystems.id, parseInt(id)),
      with: {
        components: {
          with: {
            component: {
              with: {
                variations: {
                  with: {
                    tokens: true
                  }
                }
              }
            }
          }
        },
        variationValues: {
          with: {
            tokenValues: {
              with: {
                token: true
              }
            }
          }
        }
      }
    });
    res.json(designSystem);
  } catch (error) {
    console.error('Error fetching design system:', error);
    res.status(500).json({ error: 'Failed to fetch design system' });
  }
});

app.post('/api/design-systems', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const designSystem = await db.insert(designSystems).values({
      name,
      description,
    }).returning();
    res.json(designSystem[0]);
  } catch (error) {
    console.error('Error creating design system:', error);
    res.status(500).json({ error: 'Failed to create design system' });
  }
});

app.put('/api/design-systems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const updatedDesignSystem = await db.update(designSystems)
      .set({
        name,
        description,
        updatedAt: new Date(),
      })
      .where(eq(designSystems.id, parseInt(id)))
      .returning();
    res.json(updatedDesignSystem[0]);
  } catch (error) {
    console.error('Error updating design system:', error);
    res.status(500).json({ error: 'Failed to update design system' });
  }
});

app.delete('/api/design-systems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all token values
    const variationValuesToDelete = await db.select().from(variationValues).where(eq(variationValues.designSystemId, parseInt(id)));
    for (const variationValue of variationValuesToDelete) {
      await db.delete(tokenValues).where(eq(tokenValues.variationValueId, variationValue.id));
    }
    // Then delete all variation values
    await db.delete(variationValues).where(eq(variationValues.designSystemId, parseInt(id)));
    
    // Get components associated with this design system
    const designSystemComponentsToDelete = await db.select().from(designSystemComponents).where(eq(designSystemComponents.designSystemId, parseInt(id)));
    
    // Delete tokens and variations for each component
    for (const dsc of designSystemComponentsToDelete) {
      const variationsToDelete = await db.select().from(variations).where(eq(variations.componentId, dsc.componentId));
      for (const variation of variationsToDelete) {
        await db.delete(tokens).where(eq(tokens.variationId, variation.id));
      }
      await db.delete(variations).where(eq(variations.componentId, dsc.componentId));
    }
    
    // Delete design system components
    await db.delete(designSystemComponents).where(eq(designSystemComponents.designSystemId, parseInt(id)));
    
    // Finally delete the design system
    await db.delete(designSystems).where(eq(designSystems.id, parseInt(id)));
    res.json({ message: 'Design system and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting design system:', error);
    res.status(500).json({ error: 'Failed to delete design system' });
  }
});

// Components routes
app.get('/api/components', async (req, res) => {
  try {
    const allComponents = await db.query.components.findMany({
      with: {
        variations: {
          with: {
            tokens: true
          }
        }
      }
    });
    res.json(allComponents);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

app.post('/api/components', async (req, res) => {
  try {
    const { name, description, designSystemId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create the component
    const component = await db.insert(components).values({
      name,
      description,
    }).returning();

    // If designSystemId is provided, create the relationship
    if (designSystemId) {
      await db.insert(designSystemComponents).values({
        designSystemId,
        componentId: component[0].id,
      });
    }

    res.json(component[0]);
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ error: 'Failed to create component' });
  }
});

// Get components for a specific design system
app.get('/api/design-systems/:id/components', async (req, res) => {
  try {
    const { id } = req.params;
    const designSystemComponentsList = await db.query.designSystemComponents.findMany({
      where: eq(designSystemComponents.designSystemId, parseInt(id)),
      with: {
        component: {
          with: {
            variations: {
              with: {
                tokens: true
              }
            }
          }
        }
      }
    });
    res.json(designSystemComponentsList.map(dsc => dsc.component));
  } catch (error) {
    console.error('Error fetching design system components:', error);
    res.status(500).json({ error: 'Failed to fetch design system components' });
  }
});

// Add component to design system
app.post('/api/design-systems/:id/components', async (req, res) => {
  try {
    const { id } = req.params;
    const { componentId } = req.body;
    if (!componentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const designSystemComponent = await db.insert(designSystemComponents).values({
      designSystemId: parseInt(id),
      componentId,
    }).returning();
    res.json(designSystemComponent[0]);
  } catch (error) {
    console.error('Error adding component to design system:', error);
    res.status(500).json({ error: 'Failed to add component to design system' });
  }
});

// Remove component from design system
app.delete('/api/design-systems/:id/components/:componentId', async (req, res) => {
  try {
    const { id, componentId } = req.params;
    await db.delete(designSystemComponents)
      .where(
        and(
          eq(designSystemComponents.designSystemId, parseInt(id)),
          eq(designSystemComponents.componentId, parseInt(componentId))
        )
      );
    res.json({ message: 'Component removed from design system successfully' });
  } catch (error) {
    console.error('Error removing component from design system:', error);
    res.status(500).json({ error: 'Failed to remove component from design system' });
  }
});

// Variation Values routes
app.post('/api/variation-values', async (req, res) => {
  try {
    const { designSystemId, componentId, variationId, name, description, tokenValues: newTokenValues } = req.body;
    const missingFields = [];
    if (!designSystemId) missingFields.push('designSystemId');
    if (!componentId) missingFields.push('componentId');
    if (!variationId) missingFields.push('variationId');
    if (!name) missingFields.push('name');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        missingFields 
      });
    }

    const variationValue = await db.insert(variationValues).values({
      designSystemId,
      componentId,
      variationId,
      name,
      description,
    }).returning();

    // If token values are provided, create them
    if (newTokenValues && Array.isArray(newTokenValues)) {
      const tokenValueInserts = newTokenValues.map(tv => ({
        variationValueId: variationValue[0].id,
        tokenId: tv.tokenId,
        value: tv.value
      }));
      await db.insert(tokenValues).values(tokenValueInserts);
    }

    // Return the variation value with its token values
    const variationValueWithTokens = await db.query.variationValues.findFirst({
      where: eq(variationValues.id, variationValue[0].id),
      with: {
        tokenValues: {
          with: {
            token: true
          }
        }
      }
    });

    res.json(variationValueWithTokens);
  } catch (error) {
    console.error('Error creating variation value:', error);
    res.status(500).json({ error: 'Failed to create variation value' });
  }
});

app.put('/api/variation-values/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tokenValues: updatedTokenValues } = req.body;
    const missingFields = [];
    if (!name) missingFields.push('name');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        missingFields 
      });
    }

    // Update the variation value
    const updatedVariationValue = await db.update(variationValues)
      .set({
        name,
        description,
        updatedAt: new Date(),
      })
      .where(eq(variationValues.id, parseInt(id)))
      .returning();

    // If token values are provided, update them
    if (updatedTokenValues && Array.isArray(updatedTokenValues)) {
      // First delete existing token values
      await db.delete(tokenValues).where(eq(tokenValues.variationValueId, parseInt(id)));
      // Then insert new token values
      const tokenValueInserts = updatedTokenValues.map(tv => ({
        variationValueId: parseInt(id),
        tokenId: tv.tokenId,
        value: tv.value
      }));
      await db.insert(tokenValues).values(tokenValueInserts);
    }

    // Return the updated variation value with its token values
    const variationValueWithTokens = await db.query.variationValues.findFirst({
      where: eq(variationValues.id, parseInt(id)),
      with: {
        tokenValues: {
          with: {
            token: true
          }
        }
      }
    });

    res.json(variationValueWithTokens);
  } catch (error) {
    console.error('Error updating variation value:', error);
    res.status(500).json({ error: 'Failed to update variation value' });
  }
});

app.delete('/api/variation-values/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all token values
    await db.delete(tokenValues).where(eq(tokenValues.variationValueId, parseInt(id)));
    // Then delete the variation value
    await db.delete(variationValues).where(eq(variationValues.id, parseInt(id)));
    res.json({ message: 'Variation value and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting variation value:', error);
    res.status(500).json({ error: 'Failed to delete variation value' });
  }
});

// Variations routes
app.get('/api/variations', async (req, res) => {
  try {
    const allVariations = await db.query.variations.findMany({
      with: {
        tokens: true
      }
    });
    res.json(allVariations);
  } catch (error) {
    console.error('Error fetching variations:', error);
    res.status(500).json({ error: 'Failed to fetch variations' });
  }
});

app.post('/api/variations', async (req, res) => {
  try {
    const { componentId, name, description, tokens: newTokens } = req.body;
    if (!componentId || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const variation = await db.insert(variations).values({
      componentId,
      name,
      description,
    }).returning();

    // If tokens are provided, create them
    if (newTokens && Array.isArray(newTokens)) {
      const tokenInserts = newTokens.map(t => ({
        variationId: variation[0].id,
        name: t.name,
        type: t.type,
        value: t.value
      }));
      await db.insert(tokens).values(tokenInserts);
    }

    // Return the variation with its tokens
    const variationWithTokens = await db.query.variations.findFirst({
      where: eq(variations.id, variation[0].id),
      with: {
        tokens: true
      }
    });

    res.json(variationWithTokens);
  } catch (error) {
    console.error('Error creating variation:', error);
    res.status(500).json({ error: 'Failed to create variation' });
  }
});

app.delete('/api/variations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all tokens
    await db.delete(tokens).where(eq(tokens.variationId, parseInt(id)));
    // Then delete the variation
    await db.delete(variations).where(eq(variations.id, parseInt(id)));
    res.json({ message: 'Variation and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting variation:', error);
    res.status(500).json({ error: 'Failed to delete variation' });
  }
});

// Tokens routes
app.get('/api/tokens', async (req, res) => {
  try {
    const allTokens = await db.query.tokens.findMany({
      with: {
        variation: true
      }
    });
    res.json(allTokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// Get tokens for a specific variation
app.get('/api/variations/:id/tokens', async (req, res) => {
  try {
    const { id } = req.params;
    const variationTokens = await db.query.tokens.findMany({
      where: eq(tokens.variationId, parseInt(id))
    });
    res.json(variationTokens);
  } catch (error) {
    console.error('Error fetching variation tokens:', error);
    res.status(500).json({ error: 'Failed to fetch variation tokens' });
  }
});

app.post('/api/tokens', async (req, res) => {
  try {
    const { variationId, name, type, defaultValue } = req.body;
    if (!variationId || !name || !type || !defaultValue) {
      console.log('Missing required fields:', req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const token = await db.insert(tokens).values({
      variationId,
      name,
      type,
      defaultValue,
    }).returning();
    res.json(token[0]);
  } catch (error) {
    console.error('Error creating token:', error);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

app.delete('/api/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(tokens).where(eq(tokens.id, parseInt(id)));
    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

// Update component
app.put('/api/components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const updatedComponent = await db.update(components)
      .set({
        name,
        description,
        updatedAt: new Date(),
      })
      .where(eq(components.id, parseInt(id)))
      .returning();
    res.json(updatedComponent[0]);
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// Update variation
app.put('/api/variations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, componentId } = req.body;
    if (!name || !componentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const updatedVariation = await db.update(variations)
      .set({
        name,
        description,
        componentId,
        updatedAt: new Date(),
      })
      .where(eq(variations.id, parseInt(id)))
      .returning();
    res.json(updatedVariation[0]);
  } catch (error) {
    console.error('Error updating variation:', error);
    res.status(500).json({ error: 'Failed to update variation' });
  }
});

// Update token
app.put('/api/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, value, variationId } = req.body;
    if (!name || !type || !value || !variationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const updatedToken = await db.update(tokens)
      .set({
        name,
        type,
        defaultValue: value,
        variationId,
        updatedAt: new Date(),
      })
      .where(eq(tokens.id, parseInt(id)))
      .returning();
    res.json(updatedToken[0]);
  } catch (error) {
    console.error('Error updating token:', error);
    res.status(500).json({ error: 'Failed to update token' });
  }
});

// Get available components (not yet connected to any design system)
app.get('/api/components/available', async (req, res) => {
  try {
    const allComponents = await db.query.components.findMany({
      with: {
        variations: {
          with: {
            tokens: true
          }
        }
      }
    });
    res.json(allComponents);
  } catch (error) {
    console.error('Error fetching available components:', error);
    res.status(500).json({ error: 'Failed to fetch available components' });
  }
});

// Connect component to design system
app.post('/api/design-systems/components', async (req, res) => {
  try {
    const { designSystemId, componentId } = req.body;
    if (!designSystemId || !componentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if the connection already exists
    const existingConnection = await db.query.designSystemComponents.findFirst({
      where: and(
        eq(designSystemComponents.designSystemId, designSystemId),
        eq(designSystemComponents.componentId, componentId)
      )
    });

    if (existingConnection) {
      return res.status(400).json({ error: 'Component is already connected to this design system' });
    }

    // Create the connection
    const designSystemComponent = await db.insert(designSystemComponents).values({
      designSystemId,
      componentId,
    }).returning();

    res.json(designSystemComponent[0]);
  } catch (error) {
    console.error('Error connecting component to design system:', error);
    res.status(500).json({ error: 'Failed to connect component to design system' });
  }
});

// Get single component by ID
app.get('/api/components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const component = await db.query.components.findFirst({
      where: eq(components.id, parseInt(id)),
      with: {
        variations: {
          with: {
            tokens: true
          }
        }
      }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(component);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 