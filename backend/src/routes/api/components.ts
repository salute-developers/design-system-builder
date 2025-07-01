import { Router, Request, Response } from 'express';
import { components } from '../../db/schema';
import { Database } from '../../db/types';

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
          propsAPI: true
        }
      });
      res.json(allComponents);
    } catch (error) {
      console.error('Error fetching available components:', error);
      res.status(500).json({ error: 'Failed to fetch available components' });
    }
  });

  return router;
} 