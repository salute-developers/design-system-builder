import { Router, Request, Response } from 'express';
import { users } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { Database } from '../../db/types';
import {
  validateBody,
  validateParams,
  validateQuery,
  CreateUserSchema,
  UpdateUserSchema,
  TokenQuerySchema,
  IdParamSchema
} from '../../validation';

export function createUsersRouter(db: Database) {
  const router = Router();

  // Get all users
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user by token
  router.get('/by-token',
    validateQuery(TokenQuerySchema),
    async (req: Request, res: Response) => {
    try {
      const { token } = req.query as { token: string };

      const [user] = await db.select().from(users).where(eq(users.token, token));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user by token:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get user by ID
  router.get('/:id',
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const userId = parseInt(id);

      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create new user
  router.post('/',
    validateBody(CreateUserSchema),
    async (req: Request, res: Response) => {
    try {
      const { user, token, designSystems } = req.body;

      const [newUser] = await db.insert(users)
        .values({ user, token, designSystems })
        .returning();

      res.status(201).json(newUser);
    } catch (error: any) {
      console.error('Error creating user:', error);

      // Handle unique constraint violation for token
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User with this token already exists' });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update user
  router.put('/:id',
    validateParams(IdParamSchema),
    validateBody(UpdateUserSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const userId = parseInt(id);
      const { user, token, designSystems } = req.body;

      // Build update object with only provided fields
      const updateData: Record<string, any> = { updatedAt: sql`now()` };
      if (user !== undefined) updateData.user = user;
      if (token !== undefined) updateData.token = token;
      if (designSystems !== undefined) updateData.designSystems = designSystems;

      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error: any) {
      console.error('Error updating user:', error);

      // Handle unique constraint violation for token
      if (error.code === '23505') {
        return res.status(409).json({ error: 'User with this token already exists' });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete user
  router.delete('/:id',
    validateParams(IdParamSchema),
    async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const userId = parseInt(id);

      const [deletedUser] = await db.delete(users)
        .where(eq(users.id, userId))
        .returning();

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}