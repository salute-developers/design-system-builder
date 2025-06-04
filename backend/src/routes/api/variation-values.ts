import { Router, Request, Response } from 'express';
import { variationValues, tokenValues, variations, tokens } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';

interface CreateVariationValueRequest {
  designSystemId: number;
  componentId: number;
  variationId: number;
  name: string;
  description?: string;
  tokenValues?: Array<{
    tokenId: number;
    value: string;
  }>;
}

interface UpdateVariationValueRequest {
  name: string;
  description?: string;
  tokenValues?: Array<{
    tokenId: number;
    value: string;
  }>;
}

export function createVariationValuesRouter(db: Database) {
  const router = Router();

  // Get all variation values
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const allValues = await db.select().from(variationValues);
      res.status(200).json(allValues);
    } catch (error) {
      console.error('Error fetching variation values:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get variation value by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const [value] = await db.select().from(variationValues).where(eq(variationValues.id, parseInt(req.params.id)));
      if (!value) {
        return res.status(404).json({ error: 'Variation value not found' });
      }
      res.status(200).json(value);
    } catch (error) {
      console.error('Error fetching variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create a new variation value
  router.post('/', async (req: Request<{}, {}, CreateVariationValueRequest>, res: Response) => {
    try {
      const { designSystemId, componentId, variationId, name, description, tokenValues: newTokenValues } = req.body;
      const missingFields = [];
      if (!designSystemId) missingFields.push('designSystemId');
      if (!componentId) missingFields.push('componentId');
      if (!variationId) missingFields.push('variationId');
      if (!name) missingFields.push('name');
      if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Missing required fields', missingFields });
      }

      // Check if variation exists
      const [variation] = await db.select().from(variations).where(eq(variations.id, variationId));
      if (!variation) {
        return res.status(400).json({ error: 'Variation not found' });
      }

      const [variationValue] = await db.insert(variationValues).values({
        designSystemId,
        componentId,
        variationId,
        name,
        description,
      }).returning();

      // If token values are provided, create them
      if (newTokenValues && Array.isArray(newTokenValues)) {
        const tokenValueInserts = newTokenValues.map(tv => ({
          variationValueId: variationValue.id,
          tokenId: tv.tokenId,
          value: tv.value
        }));
        await db.insert(tokenValues).values(tokenValueInserts);
      }

      res.status(201).json(variationValue);
    } catch (error) {
      if (String(error).includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ error: 'Foreign key constraint failed' });
      }
      console.error('Error creating variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update variation value
  router.put('/:id', async (req: Request<{ id: string }, {}, UpdateVariationValueRequest>, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, tokenValues: updatedTokenValues } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Missing required fields', missingFields: ['name'] });
      }

      // Check if variation value exists
      const [existingValue] = await db.select().from(variationValues).where(eq(variationValues.id, parseInt(id)));
      if (!existingValue) {
        return res.status(404).json({ error: 'Variation value not found' });
      }

      const [updated] = await db.update(variationValues)
        .set({ name, description })
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

      res.status(200).json(updated);
    } catch (error) {
      console.error('Error updating variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete variation value
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      // Check if variation value exists
      const [value] = await db.select().from(variationValues).where(eq(variationValues.id, id));
      if (!value) {
        return res.status(404).json({ error: 'Variation value not found' });
      }
      // First delete all token values
      await db.delete(tokenValues).where(eq(tokenValues.variationValueId, id));
      // Then delete the variation value
      await db.delete(variationValues).where(eq(variationValues.id, id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 