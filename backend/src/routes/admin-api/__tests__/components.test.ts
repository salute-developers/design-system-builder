import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createComponentsRouter } from '../components';
import { testDb } from '../../../test/setup';
import { components, designSystems, designSystemComponents } from '../../../db/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json());
app.use('/admin-api/components', createComponentsRouter(testDb));

describe('Components API', () => {
  let designSystemId: number;

  describe('GET /admin-api/components', () => {
    it('should return empty array when no components exist', async () => {
      const response = await request(app).get('/admin-api/components');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all components', async () => {
      // Create a test design system
      const [system] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description',
      }).returning();
      designSystemId = system.id;

      // Create test components
      const [component1] = await testDb.insert(components).values({
        name: 'Component 1',
        description: 'Test Component 1',
      }).returning();

      const [component2] = await testDb.insert(components).values({
        name: 'Component 2',
        description: 'Test Component 2',
      }).returning();

      // Create relationships
      await testDb.insert(designSystemComponents).values([
        { designSystemId, componentId: component1.id },
        { designSystemId, componentId: component2.id },
      ]);

      const response = await request(app).get('/admin-api/components');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Component 1');
      expect(response.body[1]).toHaveProperty('name', 'Component 2');
    });
  });

  describe('POST /admin-api/components', () => {
    it('should create a new component', async () => {
      // Create a test design system
      const [system] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description',
      }).returning();
      designSystemId = system.id;

      const newComponent = {
        name: 'New Component',
        description: 'Test Description',
        designSystemId,
      };

      const response = await request(app)
        .post('/admin-api/components')
        .send(newComponent);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newComponent.name);
      expect(response.body).toHaveProperty('description', newComponent.description);
      expect(response.body).toHaveProperty('id');

      // Verify the relationship was created
      const [relationship] = await testDb.select().from(designSystemComponents)
        .where(eq(designSystemComponents.componentId, response.body.id));
      expect(relationship).toBeDefined();
      expect(relationship.designSystemId).toBe(designSystemId);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/admin-api/components')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Name is required');
    });

    it('should validate design system exists', async () => {
      const response = await request(app)
        .post('/admin-api/components')
        .send({
          name: 'New Component',
          description: 'Test Description',
          designSystemId: 999, // Non-existent ID
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Design system not found');
    });
  });
}); 