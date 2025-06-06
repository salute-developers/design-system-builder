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

  return router;
} 