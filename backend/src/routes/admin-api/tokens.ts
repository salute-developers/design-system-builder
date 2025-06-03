import { Router } from 'express';
import { db } from '../../db';
import { tokens } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all tokens
router.get('/', async (req, res) => {
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
router.get('/variation/:id', async (req, res) => {
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

// Get tokens for a specific variation by ID
router.get('/:variationId/tokens', async (req, res) => {
  try {
    const { variationId } = req.params;
    const variationTokens = await db.query.tokens.findMany({
      where: eq(tokens.variationId, parseInt(variationId))
    });
    res.json(variationTokens);
  } catch (error) {
    console.error('Error fetching variation tokens:', error);
    res.status(500).json({ error: 'Failed to fetch variation tokens' });
  }
});

// Create new token
router.post('/', async (req, res) => {
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

// Update token
router.put('/:id', async (req, res) => {
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

// Delete token
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(tokens).where(eq(tokens.id, parseInt(id)));
    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router; 