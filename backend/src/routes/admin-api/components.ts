import { Router, Request, Response } from 'express';
import { components, designSystems, designSystemComponents, tokenValues, tokens, tokenVariations } from '../../db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { Database } from '../../db/types';
import { validateBody, AddInvariantTokenValuesSchema } from '../../validation';

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
          tokens: true,
          propsAPI: true
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
          tokens: true,
          propsAPI: true
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
          tokens: true,
          propsAPI: true
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
      const componentId = parseInt(id);
      const { name, description } = req.body;
      
      if (isNaN(componentId)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }
      
      if (!name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if component exists
      const [existingComponent] = await db.select().from(components).where(eq(components.id, componentId));
      if (!existingComponent) {
        return res.status(404).json({ error: 'Component not found' });
      }

      const [updatedComponent] = await db.update(components)
        .set({
          name,
          description,
          updatedAt: sql`now()`,
        })
        .where(eq(components.id, componentId))
        .returning();
      res.json(updatedComponent);
    } catch (error) {
      console.error('Error updating component:', error);
      res.status(500).json({ error: 'Failed to update component' });
    }
  });

  // Delete component
  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const componentId = parseInt(id);
      
      if (isNaN(componentId)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Delete component (cascade will handle related records)
      await db.delete(components).where(eq(components.id, componentId));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting component:', error);
      res.status(500).json({ error: 'Failed to delete component' });
    }
  });

  // Get invariant token values for a component
  router.get('/:id/invariants', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const componentId = parseInt(id);

      if (isNaN(componentId)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Get all invariant token values for this component
      const invariantTokenValues = await db.select().from(tokenValues)
        .where(and(eq(tokenValues.componentId, componentId), eq(tokenValues.type, 'invariant')));

      res.status(200).json(invariantTokenValues);
    } catch (error) {
      console.error('Error fetching invariant token values:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add/update invariant token values for a component
  router.post('/:id/invariants', 
    validateBody(AddInvariantTokenValuesSchema),
    async (req: Request<{ id: string }, {}, any>, res: Response) => {
    try {
      const { id } = req.params;
      const { tokenValues: newTokenValues } = req.body;
      const componentId = parseInt(id);

      if (isNaN(componentId)) {
        return res.status(400).json({ error: 'Invalid component ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Validate that all tokens exist and belong to this component
      const tokenIds = newTokenValues.map((tv: any) => tv.tokenId);
      const existingTokens = await db.select().from(tokens).where(eq(tokens.componentId, componentId));
      const existingTokenIds = existingTokens.map((t: any) => t.id);
      
      const invalidTokenIds = tokenIds.filter((id: any) => !existingTokenIds.includes(id));
      if (invalidTokenIds.length > 0) {
        return res.status(400).json({ 
          error: `Invalid token IDs: ${invalidTokenIds.join(', ')}. Tokens must belong to the specified component.` 
        });
      }

      // Validate that tokens don't belong to variations
      const tokensInVariations = await db.select().from(tokenVariations)
        .where(inArray(tokenVariations.tokenId, tokenIds));
      
      if (tokensInVariations.length > 0) {
        const invalidTokenIds = tokensInVariations.map((tv: any) => tv.tokenId);
        return res.status(400).json({ 
          error: `Tokens ${invalidTokenIds.join(', ')} belong to variations. Only standalone component tokens are allowed for invariants.` 
        });
      }

      // Check if any of these tokens already have invariant values for this component
      const existingInvariantValues = await db.select().from(tokenValues)
        .where(and(eq(tokenValues.componentId, componentId), eq(tokenValues.type, 'invariant')));
      
      const existingTokenIdsWithValues = existingInvariantValues.map((tv: any) => tv.tokenId);
      const tokensToUpdate = newTokenValues.filter((tv: any) => existingTokenIdsWithValues.includes(tv.tokenId));
      const tokensToCreate = newTokenValues.filter((tv: any) => !existingTokenIdsWithValues.includes(tv.tokenId));

      // Update existing token values
      for (const tokenValue of tokensToUpdate) {
        await db.update(tokenValues)
          .set({ value: tokenValue.value })
          .where(and(
            eq(tokenValues.componentId, componentId),
            eq(tokenValues.tokenId, tokenValue.tokenId),
            eq(tokenValues.type, 'invariant')
          ));
      }

      // Create new token values
      if (tokensToCreate.length > 0) {
        const tokenValueInserts = tokensToCreate.map((tv: any) => ({
          tokenId: tv.tokenId,
          value: tv.value,
          type: 'invariant' as const,
          componentId: componentId
        }));
        
        await db.insert(tokenValues).values(tokenValueInserts);
      }

      res.status(200).json({ 
        message: 'Invariant token values added/updated successfully',
        updated: tokensToUpdate.length,
        created: tokensToCreate.length
      });
    } catch (error) {
      if (String(error).includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ error: 'Foreign key constraint failed' });
      }
      console.error('Error adding invariant token values to component:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 