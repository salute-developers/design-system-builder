import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createVariationValuesRouter } from '../variation-values';
import { testDb } from '../../../test/setup';
import { variationValues, variations, components, designSystems } from '../../../db/schema';

const app = express();
app.use(express.json());

let router: ReturnType<typeof createVariationValuesRouter>;

beforeAll(() => {
  router = createVariationValuesRouter(testDb);
  app.use('/api/variation-values', router);
});

describe('Variation Values API', () => {
  let variationId: number;
  let componentId: number;
  let designSystemId: number;

  beforeEach(async () => {
    // Clear tables
    await testDb.delete(variationValues);
    await testDb.delete(variations);
    await testDb.delete(components);
    await testDb.delete(designSystems);

    // Create test data
    const [system] = await testDb.insert(designSystems).values({
      name: 'Test System',
      description: 'Test Description',
    }).returning();
    designSystemId = system.id;

    const [component] = await testDb.insert(components).values({
      name: 'Test Component',
      description: 'Test Component Description',
    }).returning();
    componentId = component.id;

    const [variation] = await testDb.insert(variations).values({
      name: 'Test Variation',
      componentId: component.id,
      description: 'Test Variation Description',
    }).returning();
    variationId = variation.id;
  });

  describe('GET /api/variation-values', () => {
    it('should return empty array when no variation values exist', async () => {
      const response = await request(app).get('/api/variation-values');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all variation values', async () => {
      // Insert test data
      await testDb.insert(variationValues).values([
        { 
          name: 'Value 1', 
          description: 'Description 1',
          designSystemId,
          componentId,
          variationId,
        },
        { 
          name: 'Value 2', 
          description: 'Description 2',
          designSystemId,
          componentId,
          variationId,
        },
      ]);

      const response = await request(app).get('/api/variation-values');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Value 1');
      expect(response.body[1]).toHaveProperty('name', 'Value 2');
    });
  });

  describe('GET /api/variation-values/:id', () => {
    it('should return 404 for non-existent variation value', async () => {
      const response = await request(app).get('/api/variation-values/999');
      expect(response.status).toBe(404);
    });

    it('should return variation value by id', async () => {
      const [variationValue] = await testDb.insert(variationValues).values({
        name: 'Test Value',
        description: 'Test Description',
        designSystemId,
        componentId,
        variationId,
      }).returning();

      const response = await request(app).get(`/api/variation-values/${variationValue.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Value');
      expect(response.body).toHaveProperty('description', 'Test Description');
      expect(response.body).toHaveProperty('designSystemId', designSystemId);
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('variationId', variationId);
    });
  });

  describe('POST /api/variation-values', () => {
    it('should create a new variation value', async () => {
      const newValue = {
        name: 'New Value',
        description: 'New Description',
        designSystemId,
        componentId,
        variationId,
      };

      const response = await request(app)
        .post('/api/variation-values')
        .send(newValue);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newValue.name);
      expect(response.body).toHaveProperty('description', newValue.description);
      expect(response.body).toHaveProperty('designSystemId', designSystemId);
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('variationId', variationId);
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/variation-values')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate all foreign keys exist', async () => {
      const response = await request(app)
        .post('/api/variation-values')
        .send({
          name: 'New Value',
          description: 'New Description',
          designSystemId: 999,
          componentId: 999,
          variationId: 999,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/variation-values/:id', () => {
    it('should update variation value', async () => {
      const [variationValue] = await testDb.insert(variationValues).values({
        name: 'Original Value',
        description: 'Original Description',
        designSystemId,
        componentId,
        variationId,
      }).returning();

      const update = {
        name: 'Updated Value',
        description: 'Updated Description',
      };

      const response = await request(app)
        .put(`/api/variation-values/${variationValue.id}`)
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', update.name);
      expect(response.body).toHaveProperty('description', update.description);
    });

    it('should return 404 for non-existent variation value', async () => {
      const response = await request(app)
        .put('/api/variation-values/999')
        .send({ 
          name: 'Updated Value',
          description: 'Updated Description'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/variation-values/:id', () => {
    it('should delete variation value', async () => {
      const [variationValue] = await testDb.insert(variationValues).values({
        name: 'To Delete',
        description: 'To Delete Description',
        designSystemId,
        componentId,
        variationId,
      }).returning();

      const response = await request(app)
        .delete(`/api/variation-values/${variationValue.id}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get(`/api/variation-values/${variationValue.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent variation value', async () => {
      const response = await request(app)
        .delete('/api/variation-values/999');

      expect(response.status).toBe(404);
    });
  });
}); 