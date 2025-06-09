import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createComponentsRouter } from '../components';
import { testDb } from '../../../test/setup';
import { components, designSystems } from '../../../db/schema';

const app = express();
app.use(express.json());

let router: ReturnType<typeof createComponentsRouter>;

beforeAll(() => {
  router = createComponentsRouter(testDb);
  app.use('/api/components', router);
});

describe('Components API', () => {
  beforeEach(async () => {
    // Clear tables
    await testDb.delete(components);
    await testDb.delete(designSystems);
  });

  describe('GET /api/components/available', () => {
    it('should return empty array when no components exist', async () => {
      const response = await request(app).get('/api/components/available');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all available components', async () => {
      // Create test components
      await testDb.insert(components).values([
        { name: 'Button', description: 'Button component' },
        { name: 'Input', description: 'Input component' },
      ]);

      const response = await request(app).get('/api/components/available');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('description');
      expect(response.body[0]).toHaveProperty('id');
    });

    it('should return components with nested relations', async () => {
      // Create test component
      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const response = await request(app).get('/api/components/available');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('variations');
      expect(response.body[0]).toHaveProperty('tokens');
      expect(Array.isArray(response.body[0].variations)).toBe(true);
      expect(Array.isArray(response.body[0].tokens)).toBe(true);
    });
  });
}); 