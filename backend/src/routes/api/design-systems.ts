import { Router, Request, Response } from 'express';
import { designSystems, designSystemComponents, variationValues, tokenValues, variations, tokens } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';

interface CreateDesignSystemRequest {
  name: string;
  description?: string;
}

interface UpdateDesignSystemRequest {
  name: string;
  description?: string;
}

export function createDesignSystemsRouter(db: Database) {
  const router = Router();

  // Get all design systems
  router.get('/', async (req: Request, res: Response) => {
    try {
      const systems = await db.select().from(designSystems);
      res.json(systems);
    } catch (error) {
      console.error('Error fetching design systems:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get single design system by ID
  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
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
                      tokenVariations: {
                        with: {
                          token: true
                        }
                      }
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
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const [system] = await db.insert(designSystems)
        .values({ name, description })
        .returning();

      res.status(201).json(system);
    } catch (error) {
      console.error('Error creating design system:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update design system
  router.put('/:id', async (req: Request<{ id: string }, {}, UpdateDesignSystemRequest>, res: Response) => {
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
          updatedAt: sql`now()`,
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
  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const designSystemId = parseInt(id);
      
      // Validate that id is a valid number
      if (isNaN(designSystemId)) {
        return res.status(400).json({ error: 'Invalid design system ID' });
      }

      // Check if design system exists
      const [system] = await db.select().from(designSystems).where(eq(designSystems.id, designSystemId));
      if (!system) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      // Delete design system (cascade will handle related records)
      await db.delete(designSystems).where(eq(designSystems.id, designSystemId));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting design system:', error);
      res.status(500).json({ error: 'Failed to delete design system' });
    }
  });

  // Add component to design system
  router.post('/components', async (req: Request, res: Response) => {
    try {
      const { designSystemId, componentId } = req.body;

      if (!designSystemId || !componentId) {
        return res.status(400).json({ error: 'Design system ID and component ID are required' });
      }

      // Validate that the design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, designSystemId));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      // Validate that the component exists  
      const [component] = await db.select().from(schema.components).where(eq(schema.components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Check if the relationship already exists
      const [existing] = await db.select().from(designSystemComponents)
        .where(and(
          eq(designSystemComponents.designSystemId, designSystemId),
          eq(designSystemComponents.componentId, componentId)
        ));

      if (existing) {
        return res.status(409).json({ error: 'Component is already part of this design system' });
      }

      // Create the relationship
      const [relationship] = await db.insert(designSystemComponents)
        .values({ designSystemId, componentId })
        .returning();

      res.status(201).json(relationship);
    } catch (error) {
      console.error('Error adding component to design system:', error);
      res.status(500).json({ error: 'Failed to add component to design system' });
    }
  });

  return router;
} 