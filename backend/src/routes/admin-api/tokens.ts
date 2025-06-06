import { Router, Request, Response } from 'express';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { Database } from '../../db/types';

interface CreateTokenRequest {
  componentId?: number;
  variationId?: number;
  name: string;
  type: string;
  defaultValue: string;
  description?: string;
  xmlParam?: string;
  composeParam?: string;
  iosParam?: string;
  webParam?: string;
}

interface UpdateTokenRequest {
  name: string;
  type: string;
  defaultValue: string;
  componentId?: number;
  variationId?: number;
  description?: string;
  xmlParam?: string;
  composeParam?: string;
  iosParam?: string;
  webParam?: string;
}

export function createTokensRouter(db: Database) {
  const router = Router();

  // Get all tokens
  router.get('/', async (req: Request, res: Response) => {
    try {
      const allTokens = await db.select().from(schema.tokens);
      res.json(allTokens);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get token by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const [token] = await db.select().from(schema.tokens).where(eq(schema.tokens.id, parseInt(req.params.id)));
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(token);
    } catch (error) {
      console.error('Error fetching token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get tokens for a specific variation
  router.get('/variation/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const variationTokens = await db.query.tokens.findMany({
        where: eq(schema.tokens.variationId, parseInt(id))
      });
      res.json(variationTokens);
    } catch (error) {
      console.error('Error fetching variation tokens:', error);
      res.status(500).json({ error: 'Failed to fetch variation tokens' });
    }
  });

  // Get tokens for a specific variation by ID
  router.get('/:variationId/tokens', async (req: Request<{ variationId: string }>, res: Response) => {
    try {
      const { variationId } = req.params;
      const variationTokens = await db.query.tokens.findMany({
        where: eq(schema.tokens.variationId, parseInt(variationId))
      });
      res.json(variationTokens);
    } catch (error) {
      console.error('Error fetching variation tokens:', error);
      res.status(500).json({ error: 'Failed to fetch variation tokens' });
    }
  });

  // Get tokens for a specific component
  router.get('/component/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
      const componentTokens = await db.query.tokens.findMany({
        where: eq(schema.tokens.componentId, parseInt(id))
      });
      res.json(componentTokens);
    } catch (error) {
      console.error('Error fetching component tokens:', error);
      res.status(500).json({ error: 'Failed to fetch component tokens' });
    }
  });

  // Get tokens for a specific component by ID (alternative endpoint)
  router.get('/component/:componentId/tokens', async (req: Request<{ componentId: string }>, res: Response) => {
    try {
      const { componentId } = req.params;
      const componentTokens = await db.query.tokens.findMany({
        where: eq(schema.tokens.componentId, parseInt(componentId))
      });
      res.json(componentTokens);
    } catch (error) {
      console.error('Error fetching component tokens:', error);
      res.status(500).json({ error: 'Failed to fetch component tokens' });
    }
  });

  // Create a new token
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, type, defaultValue, componentId, variationId, description, xmlParam, composeParam, iosParam, webParam } = req.body;

      if (!name || !type || !defaultValue) {
        return res.status(400).json({ error: 'Name, type, and defaultValue are required' });
      }

      if (!componentId && !variationId) {
        return res.status(400).json({ error: 'Either componentId or variationId must be provided' });
      }

      // Check if component exists (if componentId provided)
      if (componentId) {
        const [component] = await db.select().from(schema.components).where(eq(schema.components.id, componentId));
        if (!component) {
          return res.status(400).json({ error: 'Component not found' });
        }
      }

      // Check if variation exists (if variationId provided)
      if (variationId) {
        const [variation] = await db.select().from(schema.variations).where(eq(schema.variations.id, variationId));
        if (!variation) {
          return res.status(400).json({ error: 'Variation not found' });
        }
      }

      const [token] = await db.insert(schema.tokens)
        .values({ 
          name, 
          type, 
          defaultValue, 
          componentId,
          variationId,
          description,
          xmlParam,
          composeParam,
          iosParam,
          webParam
        })
        .returning();

      res.status(201).json(token);
    } catch (error) {
      console.error('Error creating token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update token
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { name, type, defaultValue, componentId, variationId, description, xmlParam, composeParam, iosParam, webParam } = req.body;
      const id = parseInt(req.params.id);

      const [token] = await db.select().from(schema.tokens).where(eq(schema.tokens.id, id));
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      if (!componentId && !variationId) {
        return res.status(400).json({ error: 'Either componentId or variationId must be provided' });
      }

      const [updated] = await db.update(schema.tokens)
        .set({ 
          name, 
          type, 
          defaultValue,
          componentId,
          variationId,
          description,
          xmlParam,
          composeParam,
          iosParam,
          webParam
        })
        .where(eq(schema.tokens.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete token
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const [token] = await db.select().from(schema.tokens).where(eq(schema.tokens.id, id));
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      await db.delete(schema.tokens).where(eq(schema.tokens.id, id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 