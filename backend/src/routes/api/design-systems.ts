import { Router, Request, Response } from 'express';
import { designSystems, designSystemComponents, variationValues, tokenValues, variations, tokens } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';
import { 
  validateBody, 
  validateParams,
  CreateDesignSystemSchema,
  UpdateDesignSystemSchema,
  AddComponentToDesignSystemSchema,
  IdParamSchema
} from '../../validation';

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
  router.get('/:id', 
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any; // Zod middleware ensures this is validated
      const designSystemId = parseInt(id);

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
  router.post('/', 
    validateBody(CreateDesignSystemSchema),
    async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;

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
  router.put('/:id', 
    validateParams(IdParamSchema),
    validateBody(UpdateDesignSystemSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const { name, description } = req.body;
      const designSystemId = parseInt(id);

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
  router.delete('/:id', 
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const designSystemId = parseInt(id);

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
  router.post('/components', 
    validateBody(AddComponentToDesignSystemSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, componentId } = req.body;

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

  // Remove component from design system
  router.delete('/components/:id', 
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const designSystemComponentId = parseInt(id);

      // Check if the relationship exists
      const [existing] = await db.select().from(designSystemComponents)
        .where(eq(designSystemComponents.id, designSystemComponentId));

      if (!existing) {
        return res.status(404).json({ error: 'Component not found in design system' });
      }

      // Delete the relationship
      await db.delete(designSystemComponents)
        .where(eq(designSystemComponents.id, designSystemComponentId));

      res.status(204).send();
    } catch (error) {
      console.error('Error removing component from design system:', error);
      res.status(500).json({ error: 'Failed to remove component from design system' });
    }
  });

  return router;
} 