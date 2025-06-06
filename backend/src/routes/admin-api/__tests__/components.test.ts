import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createComponentsRouter } from '../components';
import { testDb } from '../../../test/setup';
import { components, designSystems, designSystemComponents, tokens, variations, tokenVariations } from '../../../db/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json());

let router: ReturnType<typeof createComponentsRouter>;

beforeAll(() => {
  router = createComponentsRouter(testDb);
  app.use('/admin-api/components', router);
});

describe('Components API', () => {
  let designSystemId: number;

  beforeEach(async () => {
    // Clear tables in proper order due to foreign key constraints
    await testDb.delete(tokenVariations);
    await testDb.delete(tokens);
    await testDb.delete(variations);
    await testDb.delete(designSystemComponents);
    await testDb.delete(components);
    await testDb.delete(designSystems);
  });

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

  describe('GET /admin-api/components/:id', () => {
    it('should return component by id', async () => {
      // Create a test component
      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Description',
      }).returning();

      const response = await request(app).get(`/admin-api/components/${component.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Component');
      expect(response.body).toHaveProperty('description', 'Test Description');
      expect(response.body).toHaveProperty('id', component.id);
    });

    it('should return 404 for non-existent component', async () => {
      const response = await request(app).get('/admin-api/components/999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 400 for invalid component ID', async () => {
      const response = await request(app).get('/admin-api/components/invalid');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid component ID');
    });
  });

  describe('PUT /admin-api/components/:id', () => {
    it('should update component', async () => {
      // Create a test component
      const [component] = await testDb.insert(components).values({
        name: 'Original Component',
        description: 'Original Description',
      }).returning();

      const updateData = {
        name: 'Updated Component',
        description: 'Updated Description',
      };

      const response = await request(app)
        .put(`/admin-api/components/${component.id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
      expect(response.body).toHaveProperty('id', component.id);
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should return 400 when name is missing', async () => {
      // Create a test component
      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Description',
      }).returning();

      const response = await request(app)
        .put(`/admin-api/components/${component.id}`)
        .send({ description: 'Updated Description' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should return 404 when trying to update non-existent component', async () => {
      const response = await request(app)
        .put('/admin-api/components/999')
        .send({ name: 'Updated Component', description: 'Updated Description' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 400 for invalid component ID in update', async () => {
      const response = await request(app)
        .put('/admin-api/components/invalid')
        .send({ name: 'Updated Component', description: 'Updated Description' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid component ID');
    });
  });

  describe('DELETE /admin-api/components/:id', () => {
    it('should delete component', async () => {
      // Create a test component
      const [component] = await testDb.insert(components).values({
        name: 'To Delete',
        description: 'Will be deleted',
      }).returning();

      const response = await request(app)
        .delete(`/admin-api/components/${component.id}`);

      expect(response.status).toBe(204);

      // Verify component was deleted
      const getResponse = await request(app)
        .get(`/admin-api/components/${component.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent component', async () => {
      const response = await request(app)
        .delete('/admin-api/components/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 400 for invalid component ID', async () => {
      const response = await request(app)
        .delete('/admin-api/components/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid component ID');
    });
  });
}); 