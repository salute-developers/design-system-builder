import { Router, Request, Response } from 'express';
import { themes, designSystems } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { Database } from '../../db/types';
import { 
  validateBody, 
  validateParams,
  CreateThemeSchema,
  UpdateThemeSchema,
  ThemeParamsSchema
} from '../../validation';

export function createThemesRouter(db: Database) {
  const router = Router();

  // Get all themes for a design system
  router.get('/design-system/:designSystemId', 
    validateParams(ThemeParamsSchema.pick({ designSystemId: true })),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId } = req.params as any;
      const designSystemIdNum = parseInt(designSystemId);

      // Verify design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, designSystemIdNum));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      const themesList = await db.select().from(themes).where(eq(themes.designSystemId, designSystemIdNum));
      res.json(themesList);
    } catch (error) {
      console.error('Error fetching themes:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific theme by design system, name, and version
  router.get('/:designSystemId/:name/:version', 
    validateParams(ThemeParamsSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, name, version } = req.params as any;
      const designSystemIdNum = parseInt(designSystemId);

      const [theme] = await db.select().from(themes)
        .where(and(
          eq(themes.designSystemId, designSystemIdNum),
          eq(themes.name, name),
          eq(themes.version, version)
        ));

      if (!theme) {
        return res.status(404).json({ error: 'Theme not found' });
      }

      res.json(theme);
    } catch (error) {
      console.error('Error fetching theme:', error);
      res.status(500).json({ error: 'Failed to fetch theme' });
    }
  });

  // Create new theme
  router.post('/', 
    validateBody(CreateThemeSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, name, version, themeData } = req.body;

      // Verify design system exists
      const [designSystem] = await db.select().from(designSystems).where(eq(designSystems.id, designSystemId));
      if (!designSystem) {
        return res.status(404).json({ error: 'Design system not found' });
      }

      // Check if theme already exists
      const [existingTheme] = await db.select().from(themes)
        .where(and(
          eq(themes.designSystemId, designSystemId),
          eq(themes.name, name),
          eq(themes.version, version)
        ));

      if (existingTheme) {
        return res.status(409).json({ error: 'Theme with this name and version already exists for this design system' });
      }

      const [newTheme] = await db.insert(themes)
        .values({ 
          designSystemId, 
          name, 
          version, 
          themeData 
        })
        .returning();

      res.status(201).json(newTheme);
    } catch (error) {
      console.error('Error creating theme:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update theme
  router.put('/:designSystemId/:name/:version', 
    validateParams(ThemeParamsSchema),
    validateBody(UpdateThemeSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, name, version } = req.params as any;
      const { name: newName, version: newVersion, themeData } = req.body;
      const designSystemIdNum = parseInt(designSystemId);

      // Check if theme exists
      const [existingTheme] = await db.select().from(themes)
        .where(and(
          eq(themes.designSystemId, designSystemIdNum),
          eq(themes.name, name),
          eq(themes.version, version)
        ));

      if (!existingTheme) {
        return res.status(404).json({ error: 'Theme not found' });
      }

      // If updating name or version, check for conflicts
      if (newName || newVersion) {
        const finalName = newName || name;
        const finalVersion = newVersion || version;

        const [conflictTheme] = await db.select().from(themes)
          .where(and(
            eq(themes.designSystemId, designSystemIdNum),
            eq(themes.name, finalName),
            eq(themes.version, finalVersion)
          ));

        if (conflictTheme && conflictTheme.id !== existingTheme.id) {
          return res.status(409).json({ error: 'Theme with this name and version already exists for this design system' });
        }
      }

      const updatedTheme = await db.update(themes)
        .set({
          name: newName || name,
          version: newVersion || version,
          themeData: themeData || existingTheme.themeData,
          updatedAt: sql`now()`,
        })
        .where(eq(themes.id, existingTheme.id))
        .returning();

      res.json(updatedTheme[0]);
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Failed to update theme' });
    }
  });

  // Delete theme
  router.delete('/:designSystemId/:name/:version', 
    validateParams(ThemeParamsSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, name, version } = req.params as any;
      const designSystemIdNum = parseInt(designSystemId);

      // Check if theme exists
      const [existingTheme] = await db.select().from(themes)
        .where(and(
          eq(themes.designSystemId, designSystemIdNum),
          eq(themes.name, name),
          eq(themes.version, version)
        ));

      if (!existingTheme) {
        return res.status(404).json({ error: 'Theme not found' });
      }

      await db.delete(themes).where(eq(themes.id, existingTheme.id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting theme:', error);
      res.status(500).json({ error: 'Failed to delete theme' });
    }
  });

  // Check if theme exists
  router.head('/:designSystemId/:name/:version', 
    validateParams(ThemeParamsSchema),
    async (req: Request, res: Response) => {
    try {
      const { designSystemId, name, version } = req.params as any;
      const designSystemIdNum = parseInt(designSystemId);

      const [theme] = await db.select().from(themes)
        .where(and(
          eq(themes.designSystemId, designSystemIdNum),
          eq(themes.name, name),
          eq(themes.version, version)
        ));

      if (theme) {
        res.status(200).send();
      } else {
        res.status(404).send();
      }
    } catch (error) {
      console.error('Error checking theme existence:', error);
      res.status(500).send();
    }
  });

  return router;
}
