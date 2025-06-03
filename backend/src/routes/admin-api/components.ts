import { Router } from 'express';
import { db } from '../../db';
import { components, designSystemComponents } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all components
router.get('/', async (req, res) => {
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

// Get available components (not yet connected to any design system)
router.get('/available', async (req, res) => {
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

// Get single component by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const componentId = parseInt(id);
    
    // Validate that id is a valid number
    if (isNaN(componentId)) {
      return res.status(400).json({ error: 'Invalid component ID' });
    }

    const component = await db.query.components.findFirst({
      where: eq(components.id, componentId),
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

// Create new component
router.post('/', async (req, res) => {
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

// Update component
router.put('/:id', async (req, res) => {
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

export default router; 