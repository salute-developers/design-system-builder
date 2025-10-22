import { Router, Request, Response } from 'express';
import { components, tokenValues, tokens, tokenVariations, designSystems } from '../../db/schema';
import { Database } from '../../db/types';
import { eq, and, inArray } from 'drizzle-orm';
import { validateBody, AddInvariantTokenValuesSchema } from '../../validation';

export function createComponentsRouter(db: Database) {
  const router = Router();

  // Get available components (for Index.tsx to use when adding components to design systems)
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
          propsAPI: true,
          tokenValues: {
            where: (tokenValues, { eq }) => eq(tokenValues.type, 'invariant')
          }}
      });
      const transformedComponents = allComponents.map(component => ({
        ...component,
        invariantTokenValues: component.tokenValues,
        tokenValues: undefined
      }));
      
      res.json(transformedComponents);
    } catch (error) {
      console.error('Error fetching available components:', error);
      res.status(500).json({ error: 'Failed to fetch available components' });
    }
  });

  // Get invariant token values for a component in a design system
  router.get('/:id/invariants', async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const { designSystemId } = req.query as any;
      const componentId = parseInt(id);
      const dsId = parseInt(designSystemId);

      if (isNaN(componentId) || isNaN(dsId)) {
        return res.status(400).json({ error: 'Invalid component ID or design system ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Check if design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, dsId));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      // Get invariant token values for this component in this design system with token information
      const invariantTokenValues = await db.query.tokenValues.findMany({
        where: and(
          eq(tokenValues.componentId, componentId), 
          eq(tokenValues.designSystemId, dsId),
          eq(tokenValues.type, 'invariant')
        ),
        with: {
          token: true
        }
      });

      res.status(200).json(invariantTokenValues);
    } catch (error) {
      console.error('Error fetching invariant token values:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete invariant token value
  router.delete('/:id/invariants/:tokenValueId', async (req: Request, res: Response) => {
    try {
      const { id, tokenValueId } = req.params as any;
      const { designSystemId } = req.query as any;
      const componentId = parseInt(id);
      const invariantTokenValueId = parseInt(tokenValueId);
      const dsId = parseInt(designSystemId);

      if (isNaN(componentId) || isNaN(invariantTokenValueId) || isNaN(dsId)) {
        return res.status(400).json({ error: 'Invalid component ID, token value ID, or design system ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Check if design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, dsId));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      // Check if invariant token value exists and belongs to this component and design system
      const [invariantValue] = await db.select().from(tokenValues)
        .where(and(
          eq(tokenValues.id, invariantTokenValueId),
          eq(tokenValues.componentId, componentId),
          eq(tokenValues.designSystemId, dsId),
          eq(tokenValues.type, 'invariant')
        ));

      if (!invariantValue) {
        return res.status(404).json({ error: 'Invariant token value not found' });
      }

      // Delete the invariant token value
      await db.delete(tokenValues).where(eq(tokenValues.id, invariantTokenValueId));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting invariant token value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add/update invariant token values for a component in a design system
  router.post('/:id/invariants', 
    validateBody(AddInvariantTokenValuesSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const { designSystemId } = req.query as any;
      const { tokenValues: newTokenValues } = req.body;
      const componentId = parseInt(id);
      const dsId = parseInt(designSystemId);

      if (isNaN(componentId) || isNaN(dsId)) {
        return res.status(400).json({ error: 'Invalid component ID or design system ID' });
      }

      // Check if component exists
      const [component] = await db.select().from(components).where(eq(components.id, componentId));
      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      // Check if design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, dsId));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
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

      // Check if any of these tokens already have invariant values for this component in this design system
      const existingInvariantValues = await db.select().from(tokenValues)
        .where(and(
          eq(tokenValues.componentId, componentId), 
          eq(tokenValues.designSystemId, dsId),
          eq(tokenValues.type, 'invariant')
        ));
      
      const existingTokenIdsWithValues = existingInvariantValues.map((tv: any) => tv.tokenId);
      const tokensToUpdate = newTokenValues.filter((tv: any) => existingTokenIdsWithValues.includes(tv.tokenId));
      const tokensToCreate = newTokenValues.filter((tv: any) => !existingTokenIdsWithValues.includes(tv.tokenId));

      // Update existing token values
      for (const tokenValue of tokensToUpdate) {
        await db.update(tokenValues)
          .set({ value: tokenValue.value })
          .where(and(
            eq(tokenValues.componentId, componentId),
            eq(tokenValues.designSystemId, dsId),
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
          componentId: componentId,
          designSystemId: dsId
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