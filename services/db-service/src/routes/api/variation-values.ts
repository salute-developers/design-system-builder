import { Router, Request, Response } from 'express';
import { variationValues, tokenValues, variations, tokens } from '../../db/schema';
import { eq, and, not } from 'drizzle-orm';
import { Database } from '../../db/types';
import {
  validateBody,
  validateParams,
  CreateVariationValueSchema,
  UpdateVariationValueSchema,
  IdParamSchema
} from '../../validation';

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
  router.get('/:id', 
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const variationValueId = parseInt(id);
      const [value] = await db.select().from(variationValues).where(eq(variationValues.id, variationValueId));
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
  router.post('/', 
    validateBody(CreateVariationValueSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, componentId, variationId, name, description, isDefaultValue, tokenValues: newTokenValues } = req.body;

      // Check if variation exists
      const [variation] = await db.select().from(variations).where(eq(variations.id, variationId));
      if (!variation) {
        return res.status(400).json({ error: 'Variation not found' });
      }

      // If this is being set as default, unset any existing default for this variation in this design system
      if (isDefaultValue) {
        await db.update(variationValues)
          .set({ isDefaultValue: 'false' })
          .where(and(
            eq(variationValues.designSystemId, designSystemId),
            eq(variationValues.variationId, variationId)
          ));
      }

      const [variationValue] = await db.insert(variationValues).values({
        designSystemId,
        componentId,
        variationId,
        name,
        description,
        isDefaultValue: isDefaultValue ? 'true' : 'false',
      }).returning();

      // If token values are provided, create them
      if (newTokenValues && Array.isArray(newTokenValues) && newTokenValues.length > 0) {
        const tokenValueInserts = newTokenValues
          .filter(tv => tv.tokenId && tv.value && tv.value.trim() !== '') // Filter out invalid entries and empty values
          .map(tv => ({
            variationValueId: variationValue.id,
            tokenId: tv.tokenId,
            value: tv.value,
            states: tv.states
          }));
        
        if (tokenValueInserts.length > 0) {
          await db.insert(tokenValues).values(tokenValueInserts);
        }
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
  router.put('/:id', 
    validateParams(IdParamSchema),
    validateBody(UpdateVariationValueSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const { name, description, isDefaultValue, tokenValues: updatedTokenValues } = req.body;
      const variationValueId = parseInt(id);

      // Check if variation value exists
      const [existingValue] = await db.select().from(variationValues).where(eq(variationValues.id, variationValueId));
      if (!existingValue) {
        return res.status(404).json({ error: 'Variation value not found' });
      }

      // If this is being set as default, unset any existing default for this variation in this design system
      if (isDefaultValue) {
        await db.update(variationValues)
          .set({ isDefaultValue: 'false' })
          .where(and(
            eq(variationValues.designSystemId, existingValue.designSystemId),
            eq(variationValues.variationId, existingValue.variationId),
            not(eq(variationValues.id, variationValueId)) // Exclude the current record
          ));
      }

      const updateData: any = { name, description };
      if (isDefaultValue !== undefined) {
        updateData.isDefaultValue = isDefaultValue ? 'true' : 'false';
      }

      const [updated] = await db.update(variationValues)
        .set(updateData)
        .where(eq(variationValues.id, variationValueId))
        .returning();

      // If token values are provided, update them
      if (updatedTokenValues && Array.isArray(updatedTokenValues)) {
        // First delete existing token values
        await db.delete(tokenValues).where(eq(tokenValues.variationValueId, variationValueId));
        
        // Then insert new token values only if there are valid values
        const tokenValueInserts = updatedTokenValues
          .filter(tv => tv.tokenId && tv.value && tv.value.trim() !== '') // Filter out invalid entries and empty values
          .map(tv => ({
            variationValueId: variationValueId,
            tokenId: tv.tokenId,
            value: tv.value,
            states: tv.states
          }));
        
        if (tokenValueInserts.length > 0) {
          await db.insert(tokenValues).values(tokenValueInserts);
        }
      }

      res.status(200).json(updated);
    } catch (error) {
      console.error('Error updating variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete variation value
  router.delete('/:id', 
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const variationValueId = parseInt(id);
      // Check if variation value exists
      const [value] = await db.select().from(variationValues).where(eq(variationValues.id, variationValueId));
      if (!value) {
        return res.status(404).json({ error: 'Variation value not found' });
      }
      // First delete all token values
      await db.delete(tokenValues).where(eq(tokenValues.variationValueId, variationValueId));
      // Then delete the variation value
      await db.delete(variationValues).where(eq(variationValues.id, variationValueId));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting variation value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 