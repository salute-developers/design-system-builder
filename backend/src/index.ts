import express from 'express';
import cors from 'cors';
import { components, designSystems, variations, tokens } from './db/schema';
import { db } from './db';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Design Systems routes
app.get('/api/design-systems', async (req, res) => {
  try {
    const designSystemsData = await db.select().from(designSystems);
    res.json(designSystemsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch design systems' });
  }
});

app.post('/api/design-systems', async (req, res) => {
  try {
    const { name, version, owner, config } = req.body;
    const designSystem = await db.insert(designSystems).values({
      name,
      version,
      owner,
      config,
    }).returning();
    res.json(designSystem[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create design system' });
  }
});

app.delete('/api/design-systems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(designSystems).where(eq(designSystems.id, parseInt(id)));
    res.json({ message: 'Design system deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete design system' });
  }
});

// Components routes
app.get('/api/components', async (req, res) => {
  try {
    const allComponents = await db.select().from(components);
    res.json(allComponents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

app.post('/api/components', async (req, res) => {
  try {
    const { name, description } = req.body;
    const component = await db.insert(components).values({
      name,
      description,
    }).returning();
    res.json(component[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create component' });
  }
});

app.delete('/api/components/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all variations associated with this component
    await db.delete(variations).where(eq(variations.componentId, parseInt(id)));
    // Then delete the component
    await db.delete(components).where(eq(components.id, parseInt(id)));
    res.json({ message: 'Component and its variations deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

// Variations routes
app.get('/api/variations', async (req, res) => {
  try {
    const allVariations = await db.select().from(variations);
    res.json(allVariations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variations' });
  }
});

app.post('/api/variations', async (req, res) => {
  try {
    const { componentId, name, description } = req.body;
    const variation = await db.insert(variations).values({
      componentId,
      name,
      description,
    }).returning();
    res.json(variation[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create variation' });
  }
});

app.delete('/api/variations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(variations).where(eq(variations.id, parseInt(id)));
    res.json({ message: 'Variation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete variation' });
  }
});

// Tokens routes
app.get('/api/tokens', async (req, res) => {
  try {
    const allTokens = await db.select().from(tokens);
    res.json(allTokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

app.post('/api/tokens', async (req, res) => {
  try {
    const { name, type, defaultValue } = req.body;
    const token = await db.insert(tokens).values({
      name,
      type,
      defaultValue,
    }).returning();
    res.json(token[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create token' });
  }
});

app.delete('/api/tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(tokens).where(eq(tokens.id, parseInt(id)));
    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 