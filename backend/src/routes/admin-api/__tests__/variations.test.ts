import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createVariationsRouter } from '../variations';
import { testDb } from '../../../test/setup';
import { variations, components, designSystems } from '../../../db/schema';

const app = express();
app.use(express.json({ limit: '50mb' }));

let router: ReturnType<typeof createVariationsRouter>;

beforeAll(() => {
  router = createVariationsRouter(testDb);
  app.use('/admin-api/variations', router);
});

describe('Variations API', () => {
  let componentId: number;

  beforeEach(async () => {
    // Clear tables
    await testDb.delete(variations);
    await testDb.delete(components);
    await testDb.delete(designSystems);

    // Create test data
    const [system] = await testDb.insert(designSystems).values({
      name: 'Test System',
      description: 'Test Description',
    }).returning();

    const [component] = await testDb.insert(components).values({
      name: 'Test Component',
      description: 'Test Component Description',
    }).returning();

    componentId = component.id;
  });

  describe('GET /admin-api/variations', () => {
    it('should return empty array when no variations exist', async () => {
      const response = await request(app).get('/admin-api/variations');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all variations', async () => {
      // Insert test data
      await testDb.insert(variations).values([
        { name: 'Variation 1', componentId, description: 'Description 1' },
        { name: 'Variation 2', componentId, description: 'Description 2' },
      ]);

      const response = await request(app).get('/admin-api/variations');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Variation 1');
      expect(response.body[1]).toHaveProperty('name', 'Variation 2');
    });
  });

  describe('GET /admin-api/variations/:id', () => {
    it('should return 404 for non-existent variation', async () => {
      const response = await request(app).get('/admin-api/variations/999');
      expect(response.status).toBe(404);
    });

    it('should return variation by id', async () => {
      const [variation] = await testDb.insert(variations).values({
        name: 'Test Variation',
        componentId,
        description: 'Test Description',
      }).returning();

      const response = await request(app).get(`/admin-api/variations/${variation.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Variation');
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('description', 'Test Description');
    });
  });

  describe('POST /admin-api/variations', () => {
    it('should create a new variation', async () => {
      const newVariation = {
        name: 'New Variation',
        componentId,
        description: 'New Description',
      };

      const response = await request(app)
        .post('/admin-api/variations')
        .send(newVariation);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newVariation.name);
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('description', newVariation.description);
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/admin-api/variations')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate component exists', async () => {
      const response = await request(app)
        .post('/admin-api/variations')
        .send({
          name: 'New Variation',
          componentId: 999, // Non-existent ID
          description: 'New Description',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin-api/variations/:id', () => {
    it('should update variation', async () => {
      const [variation] = await testDb.insert(variations).values({
        name: 'Original Name',
        componentId,
        description: 'Original Description',
      }).returning();

      const update = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      const response = await request(app)
        .put(`/admin-api/variations/${variation.id}`)
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', update.name);
      expect(response.body).toHaveProperty('description', update.description);
    });

    it('should return 404 for non-existent variation', async () => {
      const response = await request(app)
        .put('/admin-api/variations/999')
        .send({ name: 'Updated Name', description: 'Updated Description' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin-api/variations/:id', () => {
    it('should delete variation', async () => {
      const [variation] = await testDb.insert(variations).values({
        name: 'To Delete',
        componentId,
        description: 'To Delete Description',
      }).returning();

      const response = await request(app)
        .delete(`/admin-api/variations/${variation.id}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get(`/admin-api/variations/${variation.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent variation', async () => {
      const response = await request(app)
        .delete('/admin-api/variations/999');

      expect(response.status).toBe(404);
    });
  });
}); 