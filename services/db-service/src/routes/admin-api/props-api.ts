import { Router, Request, Response } from 'express';
import { propsAPI, components } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { Database } from '../../db/types';

interface CreatePropsAPIRequest {
  componentId: number;
  name: string;
  value: string;
}

interface UpdatePropsAPIRequest {
  name?: string;
  value?: string;
}

export function createPropsAPIRouter(db: Database) {
  const router = Router();

  // Get all propsAPI for a component
  router.get('/component/:componentId', async (req: Request<{ componentId: string }>, res: Response) => {
    try {
      const { componentId } = req.params;
      const componentIdNum = parseInt(componentId);
      
      if (isNaN(componentIdNum)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentIdNum));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      const propsAPIList = await db.query.propsAPI.findMany({
        where: eq(propsAPI.componentId, componentIdNum),
        with: {
          component: true
        }
      });

      res.json(propsAPIList);
    } catch (error) {
      console.error('Error fetching propsAPI:', error);
      res.status(500).json({ error: 'Failed to fetch propsAPI' });
    }
  });

  // Get single propsAPI by ID
  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const propsAPIId = parseInt(id);
      
      if (isNaN(propsAPIId)) {
        return res.status(400).json({ error: 'Invalid propsAPI ID' });
      }

      const propsAPIItem = await db.query.propsAPI.findFirst({
        where: eq(propsAPI.id, propsAPIId),
        with: {
          component: true
        }
      });

      if (!propsAPIItem) {
        return res.status(404).json({ error: 'PropsAPI not found' });
      }

      res.json(propsAPIItem);
    } catch (error) {
      console.error('Error fetching propsAPI:', error);
      res.status(500).json({ error: 'Failed to fetch propsAPI' });
    }
  });

  // Create new propsAPI
  router.post('/', async (req: Request<{}, {}, CreatePropsAPIRequest>, res: Response) => {
    try {
      const { componentId, name, value } = req.body;

      if (!componentId || !name || value === undefined) {
        return res.status(400).json({ error: 'componentId, name, and value are required' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(400).json({ error: 'Component not found' });
      }

      // Check if propsAPI with same name already exists for this component
      const existingPropsAPI = await db.query.propsAPI.findFirst({
        where: and(
          eq(propsAPI.componentId, componentId),
          eq(propsAPI.name, name)
        )
      });

      if (existingPropsAPI) {
        return res.status(400).json({ error: 'PropsAPI with this name already exists for this component' });
      }

      const [newPropsAPI] = await db.insert(propsAPI)
        .values({ componentId, name, value })
        .returning();

      res.status(201).json(newPropsAPI);
    } catch (error) {
      console.error('Error creating propsAPI:', error);
      res.status(500).json({ error: 'Failed to create propsAPI' });
    }
  });

  // Update propsAPI
  router.put('/:id', async (req: Request<{ id: string }, {}, UpdatePropsAPIRequest>, res: Response) => {
    try {
      const { id } = req.params;
      const propsAPIId = parseInt(id);
      const { name, value } = req.body;
      
      if (isNaN(propsAPIId)) {
        return res.status(400).json({ error: 'Invalid propsAPI ID' });
      }

      if (!name && value === undefined) {
        return res.status(400).json({ error: 'At least one field (name or value) is required' });
      }

      // Check if propsAPI exists
      const [existingPropsAPI] = await db.select().from(propsAPI).where(eq(propsAPI.id, propsAPIId));
      if (!existingPropsAPI) {
        return res.status(404).json({ error: 'PropsAPI not found' });
      }

      // If updating name, check if new name already exists for the same component
      if (name && name !== existingPropsAPI.name) {
        const duplicatePropsAPI = await db.query.propsAPI.findFirst({
          where: and(
            eq(propsAPI.componentId, existingPropsAPI.componentId),
            eq(propsAPI.name, name)
          )
        });

        if (duplicatePropsAPI) {
          return res.status(400).json({ error: 'PropsAPI with this name already exists for this component' });
        }
      }

      const updateData: Partial<typeof existingPropsAPI> = {};
      if (name !== undefined) updateData.name = name;
      if (value !== undefined) updateData.value = value;

      const [updatedPropsAPI] = await db.update(propsAPI)
        .set(updateData)
        .where(eq(propsAPI.id, propsAPIId))
        .returning();

      res.json(updatedPropsAPI);
    } catch (error) {
      console.error('Error updating propsAPI:', error);
      res.status(500).json({ error: 'Failed to update propsAPI' });
    }
  });

  // Delete propsAPI
  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const propsAPIId = parseInt(id);
      
      if (isNaN(propsAPIId)) {
        return res.status(400).json({ error: 'Invalid propsAPI ID' });
      }

      // Check if propsAPI exists
      const [existingPropsAPI] = await db.select().from(propsAPI).where(eq(propsAPI.id, propsAPIId));
      if (!existingPropsAPI) {
        return res.status(404).json({ error: 'PropsAPI not found' });
      }

      await db.delete(propsAPI).where(eq(propsAPI.id, propsAPIId));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting propsAPI:', error);
      res.status(500).json({ error: 'Failed to delete propsAPI' });
    }
  });

  return router;
} 