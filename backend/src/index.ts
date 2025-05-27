import express from 'express';
import cors from 'cors';
import { components, variations, tokens } from './db/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Components routes
app.get('/api/components', async (req, res) => {
  try {
    const allComponents = await db.query.components.findMany({
      // with: {
      //   variations: {
      //     with: {
      //       tokens: true
      //     }
      //   }
      // }
    });
    res.json(allComponents);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

app.get('/api/components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const component = await db.query.components.findFirst({
      with: {
        variations: {
          // with: {
          //   tokens: true
          // }
        }
      },
      where: eq(components.id, parseInt(id)),
    });
    res.json(component);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

app.post('/api/components', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const component = await db.insert(components).values({
      name,
      description,
    }).returning();
    res.json(component[0]);
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ error: 'Failed to create component' });
  }
});

app.delete('/api/components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all tokens associated with variations
    const variationsToDelete = await db.select().from(variations).where(eq(variations.componentId, parseInt(id)));
    for (const variation of variationsToDelete) {
      await db.delete(tokens).where(eq(tokens.variationId, variation.id));
    }
    // Then delete all variations
    await db.delete(variations).where(eq(variations.componentId, parseInt(id)));
    // Finally delete the component
    await db.delete(components).where(eq(components.id, parseInt(id)));
    res.json({ message: 'Component and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ error: 'Failed to delete component' });
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 