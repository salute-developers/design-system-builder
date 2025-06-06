import { Router, Request, Response } from 'express';
import { components, designSystems, designSystemComponents } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';

interface CreateComponentRequest {
  name: string;
  description?: string;
  designSystemId?: number;
}

interface UpdateComponentRequest {
  name: string;
  description?: string;
}

export function createComponentsRouter(db: Database) {
  const router = Router();

  // Get all components
  router.get('/', async (req: Request, res: Response) => {
    try {
      const allComponents = await db.query.components.findMany({
        with: {
          variations: {
            with: {
              tokenVariations: {
                with: {
                  token: true
                }
              }
            }
          },
          tokens: true
        }
      });
      res.json(allComponents);
    } catch (error) {
      console.error('Error fetching components:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get available components (not yet connected to any design system)
  router.get('/available', async (_req: Request, res: Response) => {
    try {
      const allComponents = await db.query.components.findMany({
        with: {
          variations: {
            with: {
              tokenVariations: {
                with: {
                  token: true
                }
              }
            }
          },
          tokens: true
        }
      });
      res.json(allComponents);
    } catch (error) {
      console.error('Error fetching available components:', error);
      res.status(500).json({ error: 'Failed to fetch available components' });
    }
  });

  // Get single component by ID
  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const componentId = parseInt(id);
      if (isNaN(componentId)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }
      const component = await db.query.components.findFirst({
        where: eq(components.id, componentId),
        with: {
          variations: {
            with: {
              tokenVariations: {
                with: {
                  token: true
                }
              }
            }
          },
          tokens: true
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
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, description, designSystemId } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      if (designSystemId) {
        // Check if design system exists
        const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, designSystemId));
        if (!designSystem) {
          return res.status(400).json({ error: 'Design system not found' });
        }
      }

      // Create component
      const [component] = await db.insert(components)
        .values({ name, description })
        .returning();

      // If designSystemId is provided, create the relationship
      if (designSystemId) {
        await db.insert(designSystemComponents)
          .values({ designSystemId, componentId: component.id });
      }

      res.status(201).json(component);
    } catch (error) {
      console.error('Error creating component:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update component
  router.put('/:id', async (req: Request<{ id: string }, {}, UpdateComponentRequest>, res: Response) => {
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
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(components.id, parseInt(id)))
        .returning();
      res.json(updatedComponent[0]);
    } catch (error) {
      console.error('Error updating component:', error);
      res.status(500).json({ error: 'Failed to update component' });
    }
  });

  return router;
} 