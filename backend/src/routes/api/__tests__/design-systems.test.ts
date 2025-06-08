import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDesignSystemsRouter } from '../design-systems';
import { testDb } from '../../../test/setup';
import { designSystems, components } from '../../../db/schema';

const app = express();
app.use(express.json());

let router: ReturnType<typeof createDesignSystemsRouter>;

beforeAll(() => {
  router = createDesignSystemsRouter(testDb);
  app.use('/api/design-systems', router);
});

describe('Design Systems API', () => {
  beforeEach(async () => {
    // Clear the design systems table before each test
    await testDb.delete(designSystems);
    await testDb.delete(components);
  });

  describe('GET /api/design-systems', () => {
    it('should return empty array when no design systems exist', async () => {
      const response = await request(app).get('/api/design-systems');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all design systems', async () => {
      // Insert test data
      await testDb.insert(designSystems).values([
        { name: 'Test System 1', description: 'Description 1' },
        { name: 'Test System 2', description: 'Description 2' },
      ]);

      const response = await request(app).get('/api/design-systems');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Test System 1');
      expect(response.body[1]).toHaveProperty('name', 'Test System 2');
    });
  });

  describe('POST /api/design-systems', () => {
    it('should create a new design system', async () => {
      const newSystem = {
        name: 'New System',
        description: 'New Description',
      };

      const response = await request(app)
        .post('/api/design-systems')
        .send(newSystem);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newSystem.name);
      expect(response.body).toHaveProperty('description', newSystem.description);
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/design-systems')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/design-systems/components', () => {
    it('should add a component to a design system', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description'
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Component Description'
      }).returning();

      const response = await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: designSystem.id,
          componentId: component.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('designSystemId', designSystem.id);
      expect(response.body).toHaveProperty('componentId', component.id);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/design-systems/components')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Design system ID and component ID are required');
    });

    it('should return 404 for non-existent design system', async () => {
      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Component Description'
      }).returning();

      const response = await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: 999,
          componentId: component.id
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Design system not found');
    });

    it('should return 404 for non-existent component', async () => {
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description'
      }).returning();

      const response = await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: designSystem.id,
          componentId: 999
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 409 for duplicate component assignment', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description'
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Component Description'
      }).returning();

      // Add component to design system first time
      await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: designSystem.id,
          componentId: component.id
        });

      // Try to add the same component again
      const response = await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: designSystem.id,
          componentId: component.id
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Component is already part of this design system');
    });
  });

  describe('DELETE /api/design-systems/components/:id', () => {
    it('should remove component from design system', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test System',
        description: 'Test Description'
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Test Component',
        description: 'Test Component Description'
      }).returning();

      // Add component to design system first
      const addResponse = await request(app)
        .post('/api/design-systems/components')
        .send({
          designSystemId: designSystem.id,
          componentId: component.id
        });

      expect(addResponse.status).toBe(201);
      const designSystemComponentId = addResponse.body.id;

      // Now remove it
      const removeResponse = await request(app)
        .delete(`/api/design-systems/components/${designSystemComponentId}`);

      expect(removeResponse.status).toBe(204);
    });

    it('should return 404 for non-existent design system component', async () => {
      const response = await request(app)
        .delete('/api/design-systems/components/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found in design system');
    });

    it('should return 400 for invalid design system component ID', async () => {
      const response = await request(app)
        .delete('/api/design-systems/components/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid design system component ID');
    });
  });
}); 