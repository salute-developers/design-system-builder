import { Router } from 'express';
import { db } from '../../db';
import { variations, tokens } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all variations
router.get('/', async (req, res) => {
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

// Create new variation
router.post('/', async (req, res) => {
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

// Update variation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const variationId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(variationId)) {
      return res.status(400).json({ error: 'Invalid variation ID' });
    }

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
      .where(eq(variations.id, variationId))
      .returning();
    res.json(updatedVariation[0]);
  } catch (error) {
    console.error('Error updating variation:', error);
    res.status(500).json({ error: 'Failed to update variation' });
  }
});

// Delete variation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const variationId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(variationId)) {
      return res.status(400).json({ error: 'Invalid variation ID' });
    }

    // First delete all tokens
    await db.delete(tokens).where(eq(tokens.variationId, variationId));
    // Then delete the variation
    await db.delete(variations).where(eq(variations.id, variationId));
    res.json({ message: 'Variation and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting variation:', error);
    res.status(500).json({ error: 'Failed to delete variation' });
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

export default router; 