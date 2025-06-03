import { Router } from 'express';
import { db } from '../../db';
import { designSystems, designSystemComponents, variationValues, tokenValues, variations, tokens } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Get all design systems
router.get('/', async (req, res) => {
  try {
    const allDesignSystems = await db.query.designSystems.findMany({});
    res.json(allDesignSystems);
  } catch (error) {
    console.error('Error fetching design systems:', error);
    res.status(500).json({ error: 'Failed to fetch design systems' });
  }
});

// Get single design system by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const designSystemId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(designSystemId)) {
      return res.status(400).json({ error: 'Invalid design system ID' });
    }

    const designSystem = await db.query.designSystems.findFirst({
      where: eq(designSystems.id, designSystemId),
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

// Create new design system
router.post('/', async (req, res) => {
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

// Update design system
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const designSystemId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(designSystemId)) {
      return res.status(400).json({ error: 'Invalid design system ID' });
    }

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
      .where(eq(designSystems.id, designSystemId))
      .returning();
    res.json(updatedDesignSystem[0]);
  } catch (error) {
    console.error('Error updating design system:', error);
    res.status(500).json({ error: 'Failed to update design system' });
  }
});

// Delete design system
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const designSystemId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(designSystemId)) {
      return res.status(400).json({ error: 'Invalid design system ID' });
    }

    // First delete all token values
    const variationValuesToDelete = await db.select().from(variationValues).where(eq(variationValues.designSystemId, designSystemId));
    for (const variationValue of variationValuesToDelete) {
      await db.delete(tokenValues).where(eq(tokenValues.variationValueId, variationValue.id));
    }
    // Then delete all variation values
    await db.delete(variationValues).where(eq(variationValues.designSystemId, designSystemId));
    
    // Get components associated with this design system
    const designSystemComponentsToDelete = await db.select().from(designSystemComponents).where(eq(designSystemComponents.designSystemId, designSystemId));
    
    // Delete tokens and variations for each component
    for (const dsc of designSystemComponentsToDelete) {
      const variationsToDelete = await db.select().from(variations).where(eq(variations.componentId, dsc.componentId));
      for (const variation of variationsToDelete) {
        await db.delete(tokens).where(eq(tokens.variationId, variation.id));
      }
      await db.delete(variations).where(eq(variations.componentId, dsc.componentId));
    }
    
    // Delete design system components
    await db.delete(designSystemComponents).where(eq(designSystemComponents.designSystemId, designSystemId));
    
    // Finally delete the design system
    await db.delete(designSystems).where(eq(designSystems.id, designSystemId));
    res.json({ message: 'Design system and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting design system:', error);
    res.status(500).json({ error: 'Failed to delete design system' });
  }
});

export default router; 