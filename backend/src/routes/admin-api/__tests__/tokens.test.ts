import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTokensRouter } from '../tokens';
import { testDb } from '../../../test/setup';
import { tokens, variations, components, designSystems } from '../../../db/schema';

const app = express();
app.use(express.json());
app.use('/admin-api/tokens', createTokensRouter(testDb));

describe('Tokens API', () => {
  let variationId: number;

  beforeEach(async () => {
    // Clear tables
    await testDb.delete(tokens);
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

    const [variation] = await testDb.insert(variations).values({
      name: 'Test Variation',
      componentId: component.id,
      description: 'Test Variation Description',
    }).returning();

    variationId = variation.id;
  });

  describe('GET /admin-api/tokens', () => {
    it('should return empty array when no tokens exist', async () => {
      const response = await request(app).get('/admin-api/tokens');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all tokens', async () => {
      // Insert test data
      await testDb.insert(tokens).values([
        { name: 'Token 1', type: 'color', defaultValue: 'value1', variationId },
        { name: 'Token 2', type: 'spacing', defaultValue: 'value2', variationId },
      ]);

      const response = await request(app).get('/admin-api/tokens');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('name', 'Token 1');
      expect(response.body[1]).toHaveProperty('name', 'Token 2');
    });
  });

  describe('GET /admin-api/tokens/:id', () => {
    it('should return 404 for non-existent token', async () => {
      const response = await request(app).get('/admin-api/tokens/999');
      expect(response.status).toBe(404);
    });

    it('should return token by id', async () => {
      const [token] = await testDb.insert(tokens).values({
        name: 'Test Token',
        type: 'color',
        defaultValue: 'test-value',
        variationId,
      }).returning();

      const response = await request(app).get(`/admin-api/tokens/${token.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Token');
      expect(response.body).toHaveProperty('type', 'color');
      expect(response.body).toHaveProperty('defaultValue', 'test-value');
      expect(response.body).toHaveProperty('variationId', variationId);
    });
  });

  describe('POST /admin-api/tokens', () => {
    it('should create a new token', async () => {
      const newToken = {
        name: 'New Token',
        type: 'color',
        defaultValue: 'new-value',
        variationId,
      };

      const response = await request(app)
        .post('/admin-api/tokens')
        .send(newToken);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newToken.name);
      expect(response.body).toHaveProperty('type', newToken.type);
      expect(response.body).toHaveProperty('defaultValue', newToken.defaultValue);
      expect(response.body).toHaveProperty('variationId', variationId);
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/admin-api/tokens')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate variation exists', async () => {
      const response = await request(app)
        .post('/admin-api/tokens')
        .send({
          name: 'New Token',
          type: 'color',
          defaultValue: 'new-value',
          variationId: 999, // Non-existent ID
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin-api/tokens/:id', () => {
    it('should update token', async () => {
      const [token] = await testDb.insert(tokens).values({
        name: 'Original Token',
        type: 'color',
        defaultValue: 'original-value',
        variationId,
      }).returning();

      const update = {
        name: 'Updated Token',
        type: 'spacing',
        defaultValue: 'updated-value',
      };

      const response = await request(app)
        .put(`/admin-api/tokens/${token.id}`)
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', update.name);
      expect(response.body).toHaveProperty('type', update.type);
      expect(response.body).toHaveProperty('defaultValue', update.defaultValue);
    });

    it('should return 404 for non-existent token', async () => {
      const response = await request(app)
        .put('/admin-api/tokens/999')
        .send({ 
          name: 'Updated Token',
          type: 'color',
          defaultValue: 'updated-value'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin-api/tokens/:id', () => {
    it('should delete token', async () => {
      const [token] = await testDb.insert(tokens).values({
        name: 'To Delete',
        type: 'color',
        defaultValue: 'delete-value',
        variationId,
      }).returning();

      const response = await request(app)
        .delete(`/admin-api/tokens/${token.id}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const getResponse = await request(app)
        .get(`/admin-api/tokens/${token.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent token', async () => {
      const response = await request(app)
        .delete('/admin-api/tokens/999');

      expect(response.status).toBe(404);
    });
  });
}); 