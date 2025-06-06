import { Router, Request, Response } from 'express';
import * as schema from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { Database } from '../../db/types';

interface CreateTokenRequest {
  componentId?: number;
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
  componentId?: number;
  name: string;
  type: string;
  defaultValue: string;
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
      const variationTokens = await db.query.tokenVariations.findMany({
        where: eq(schema.tokenVariations.variationId, parseInt(id)),
        with: {
          token: true
        }
      });
      const tokens = variationTokens.map(tv => tv.token);
      res.json(tokens);
    } catch (error) {
      console.error('Error fetching variation tokens:', error);
      res.status(500).json({ error: 'Failed to fetch variation tokens' });
    }
  });

  // Create a new token
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { 
        componentId, 
        name, 
        type, 
        defaultValue, 
        description, 
        xmlParam, 
        composeParam, 
        iosParam, 
        webParam 
      }: CreateTokenRequest = req.body;

      const [token] = await db.insert(schema.tokens).values({
        componentId,
        name,
        type,
        defaultValue,
        description,
        xmlParam,
        composeParam,
        iosParam,
        webParam,
      }).returning();

      res.status(201).json(token);
    } catch (error) {
      console.error('Error creating token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update token
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { 
        componentId, 
        name, 
        type, 
        defaultValue, 
        description, 
        xmlParam, 
        composeParam, 
        iosParam, 
        webParam 
      }: UpdateTokenRequest = req.body;
      const id = parseInt(req.params.id);

      const [token] = await db.select().from(schema.tokens).where(eq(schema.tokens.id, id));
      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      const [updated] = await db.update(schema.tokens)
        .set({ 
          componentId, 
          name, 
          type, 
          defaultValue, 
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

  // Assign token to variation
  router.post('/:tokenId/variations/:variationId', async (req: Request, res: Response) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      const variationId = parseInt(req.params.variationId);

      // Check if assignment already exists
      const existing = await db.query.tokenVariations.findFirst({
        where: (tokenVariations, { and, eq }) => and(
          eq(tokenVariations.tokenId, tokenId),
          eq(tokenVariations.variationId, variationId)
        )
      });

      if (existing) {
        return res.status(400).json({ error: 'Token already assigned to this variation' });
      }

      const [assignment] = await db.insert(schema.tokenVariations)
        .values({ tokenId, variationId })
        .returning();

      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error assigning token to variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Remove token from variation
  router.delete('/:tokenId/variations/:variationId', async (req: Request, res: Response) => {
    try {
      const tokenId = parseInt(req.params.tokenId);
      const variationId = parseInt(req.params.variationId);

      await db.delete(schema.tokenVariations)
        .where(
          and(
            eq(schema.tokenVariations.tokenId, tokenId),
            eq(schema.tokenVariations.variationId, variationId)
          )
        );

      res.status(204).send();
    } catch (error) {
      console.error('Error removing token from variation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
} 