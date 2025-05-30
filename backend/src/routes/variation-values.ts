import { Router } from 'express';
import { db } from '../db';
import { variationValues, tokenValues } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Create new variation value
router.post('/', async (req, res) => {
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

// Update variation value
router.put('/:id', async (req, res) => {
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

// Delete variation value
router.delete('/:id', async (req, res) => {
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

export default router; 