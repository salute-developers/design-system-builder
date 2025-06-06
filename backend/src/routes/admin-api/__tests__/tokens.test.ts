import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTokensRouter } from '../tokens';
import { testDb } from '../../../test/setup';
import { tokens, variations, components, designSystems, tokenVariations } from '../../../db/schema';

const app = express();
app.use(express.json());

let router: ReturnType<typeof createTokensRouter>;

beforeAll(() => {
  router = createTokensRouter(testDb);
  app.use('/admin-api/tokens', router);
});

describe('Tokens API', () => {
  let variationId: number;
  let componentId: number;

  beforeEach(async () => {
    // Clear tables in proper order due to foreign key constraints
    await testDb.delete(tokenVariations);
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

    componentId = component.id;
    variationId = variation.id;
  });

  describe('GET /admin-api/tokens', () => {
    it('should return empty array when no tokens exist', async () => {
      const response = await request(app).get('/admin-api/tokens');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all tokens', async () => {
      // Insert test tokens
      const [token1] = await testDb.insert(tokens).values({
        name: 'Token 1',
        type: 'color',
        defaultValue: 'value1',
        componentId,
      }).returning();

      const [token2] = await testDb.insert(tokens).values({
        name: 'Token 2', 
        type: 'spacing',
        defaultValue: 'value2',
        componentId,
      }).returning();

      // Assign tokens to variation
      await testDb.insert(tokenVariations).values([
        { tokenId: token1.id, variationId },
        { tokenId: token2.id, variationId }
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
        componentId,
      }).returning();

      // Assign token to variation
      await testDb.insert(tokenVariations).values({
        tokenId: token.id,
        variationId,
      });

      const response = await request(app).get(`/admin-api/tokens/${token.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Test Token');
      expect(response.body).toHaveProperty('type', 'color');
      expect(response.body).toHaveProperty('defaultValue', 'test-value');
      expect(response.body).toHaveProperty('componentId', componentId);
    });
  });

  describe('POST /admin-api/tokens', () => {
    it('should create a new token', async () => {
      const newToken = {
        name: 'New Token',
        type: 'color',
        defaultValue: 'new-value',
        componentId,
      };

      const response = await request(app)
        .post('/admin-api/tokens')
        .send(newToken);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newToken.name);
      expect(response.body).toHaveProperty('type', newToken.type);
      expect(response.body).toHaveProperty('defaultValue', newToken.defaultValue);
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('id');
    });

    it('should create a new token without defaultValue (optional)', async () => {
      const newToken = {
        name: 'Token Without Default',
        type: 'color',
        componentId,
        description: 'Token without default value'
      };

      const response = await request(app)
        .post('/admin-api/tokens')
        .send(newToken);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', newToken.name);
      expect(response.body).toHaveProperty('type', newToken.type);
      expect(response.body).toHaveProperty('defaultValue', null);
      expect(response.body).toHaveProperty('componentId', componentId);
      expect(response.body).toHaveProperty('description', newToken.description);
      expect(response.body).toHaveProperty('id');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/admin-api/tokens')
        .send({});

      expect(response.status).toBe(500); // Database constraint violation
      expect(response.body).toHaveProperty('error');
    });

    it('should validate component exists', async () => {
      const response = await request(app)
        .post('/admin-api/tokens')
        .send({
          name: 'New Token',
          type: 'color',
          defaultValue: 'new-value',
          componentId: 999, // Non-existent ID
        });

      expect(response.status).toBe(500); // Foreign key constraint violation
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /admin-api/tokens/:id', () => {
    it('should update token', async () => {
      const [token] = await testDb.insert(tokens).values({
        name: 'Original Token',
        type: 'color',
        defaultValue: 'original-value',
        componentId,
        description: 'Test description',
        xmlParam: 'test-xml',
        composeParam: 'test-compose',
        iosParam: 'test-ios',
        webParam: 'test-web'
      }).returning();

      const update = {
        name: 'Updated Token',
        type: 'spacing',
        defaultValue: 'updated-value',
        description: 'Updated description',
        xmlParam: 'updated-xml',
        composeParam: 'updated-compose',
        iosParam: 'updated-ios',
        webParam: 'updated-web'
      };

      const response = await request(app)
        .put(`/admin-api/tokens/${token.id}`)
        .send(update);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', update.name);
      expect(response.body).toHaveProperty('type', update.type);
      expect(response.body).toHaveProperty('defaultValue', update.defaultValue);
      expect(response.body).toHaveProperty('description', update.description);
      expect(response.body).toHaveProperty('xmlParam', update.xmlParam);
      expect(response.body).toHaveProperty('composeParam', update.composeParam);
      expect(response.body).toHaveProperty('iosParam', update.iosParam);
      expect(response.body).toHaveProperty('webParam', update.webParam);
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
        componentId,
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