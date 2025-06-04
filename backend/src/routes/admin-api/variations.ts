import { Router, Request, Response } from 'express';
import { variations, components, tokens } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';

interface CreateVariationRequest {
  componentId: number;
  name: string;
  description?: string;
  tokens?: Array<{
    name: string;
    type: string;
    defaultValue: string;
  }>;
}

interface UpdateVariationRequest {
  name: string;
  description?: string;
  tokens?: Array<{
    id?: number;
    name: string;
    type: string;
    defaultValue: string;
  }>;
}

export function createVariationsRouter(db: Database) {
  const router = Router();

  // Get all variations
  router.get('/', async (req: Request, res: Response) => {
    try {
      const allVariations = await db.select().from(variations);
      res.json(allVariations);
    } catch (error) {
      console.error('Error fetching variations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get variation by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const [variation] = await db.select().from(variations).where(eq(variations.id, parseInt(req.params.id)));
      if (!variation) {
        return res.status(404).json({ error: 'Variation not found' });
      }
      res.json(variation);
    } catch (error) {
      console.error('Error fetching variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create a new variation
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, componentId } = req.body;

      if (!name || !componentId) {
        return res.status(400).json({ error: 'Name and componentId are required' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(400).json({ error: 'Component not found' });
      }

      const [variation] = await db.insert(variations)
        .values({ name, description, componentId })
        .returning();

      res.status(201).json(variation);
    } catch (error) {
      console.error('Error creating variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update variation
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const id = parseInt(req.params.id);

      const [variation] = await db.select().from(variations).where(eq(variations.id, id));
      if (!variation) {
        return res.status(404).json({ error: 'Variation not found' });
      }

      const [updated] = await db.update(variations)
        .set({ name, description })
        .where(eq(variations.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete variation
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const [variation] = await db.select().from(variations).where(eq(variations.id, id));
      if (!variation) {
        return res.status(404).json({ error: 'Variation not found' });
      }

      await db.delete(variations).where(eq(variations.id, id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get tokens for a specific variation by ID
  router.get('/:id/tokens', async (req, res) => {
    try {
      const { id } = req.params;
      const variationId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(variationId)) {
        return res.status(400).json({ error: 'Invalid variation ID' });
      }

      const variationTokens = await db.query.tokens.findMany({
        where: eq(tokens.variationId, variationId)
      });
      res.json(variationTokens);
    } catch (error) {
      console.error('Error fetching variation tokens:', error);
      res.status(500).json({ error: 'Failed to fetch variation tokens' });
    }
  });

  return router;
} 