import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createComponentsRouter } from '../components';
import { testDb } from '../../../test/setup';
import { components, designSystems, tokens, tokenValues, tokenVariations, variations } from '../../../db/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(express.json({ limit: '50mb' }));

let router: ReturnType<typeof createComponentsRouter>;

beforeAll(() => {
  router = createComponentsRouter(testDb);
  app.use('/api/components', router);
});

describe('Components API', () => {
  beforeEach(async () => {
    // Clear tables
    await testDb.delete(tokenValues);
    await testDb.delete(tokenVariations);
    await testDb.delete(variations);
    await testDb.delete(tokens);
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

  describe('GET /api/components/:id/invariants', () => {
    it('should return 404 when component does not exist', async () => {
      const response = await request(app).get('/api/components/999/invariants');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return empty array when component has no invariant token values', async () => {
      // Create test component
      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const response = await request(app).get(`/api/components/${component.id}/invariants`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return invariant token values for component', async () => {
      // Create test component and token
      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      const [tokenValue] = await testDb.insert(tokenValues).values({
        tokenId: token.id,
        value: '#007bff',
        type: 'invariant',
        componentId: component.id
      }).returning();

      const response = await request(app).get(`/api/components/${component.id}/invariants`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('tokenId', token.id);
      expect(response.body[0]).toHaveProperty('value', '#007bff');
      expect(response.body[0]).toHaveProperty('type', 'invariant');
    });
  });

  describe('POST /api/components/:id/invariants', () => {
    it('should return 404 when component does not exist', async () => {
      const response = await request(app)
        .post('/api/components/999/invariants?designSystemId=1')
        .send({
          tokenValues: [
            { tokenId: 1, value: '#007bff' }
          ]
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 400 when token does not belong to component', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      // Create token for different component
      const [otherComponent] = await testDb.insert(components).values({
        name: 'Input',
        description: 'Input component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'inputColor',
        type: 'color',
        componentId: otherComponent.id
      }).returning();

      const response = await request(app)
        .post(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`)
        .send({
          tokenValues: [
            { tokenId: token.id, value: '#007bff' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid token IDs');
    });

    it('should return 400 when token belongs to variation', async () => {
      // Create test component and token
      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      // Create a variation that belongs to the component
      const [componentVariation] = await testDb.insert(variations).values({
        name: 'Test Variation',
        description: 'Test variation',
        componentId: component.id
      }).returning();

      await testDb.insert(tokenVariations).values({
        tokenId: token.id,
        variationId: componentVariation.id
      });

      const response = await request(app)
        .post(`/api/components/${component.id}/invariants`)
        .send({
          tokenValues: [
            { tokenId: token.id, value: '#007bff' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('belong to variations');
    });

    it('should create new invariant token values', async () => {
      // Create test design system, component and token
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      const response = await request(app)
        .post(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`)
        .send({
          tokenValues: [
            { tokenId: token.id, value: '#007bff' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Invariant token values added/updated successfully');
      expect(response.body).toHaveProperty('created', 1);
      expect(response.body).toHaveProperty('updated', 0);

      // Verify token value was created
      const [tokenValue] = await testDb.select().from(tokenValues)
        .where(eq(tokenValues.componentId, component.id));
      expect(tokenValue).toBeDefined();
      expect(tokenValue?.value).toBe('#007bff');
      expect(tokenValue?.type).toBe('invariant');
    });

    it('should update existing invariant token values', async () => {
      // Create test design system, component and token
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      // Create existing token value
      await testDb.insert(tokenValues).values({
        tokenId: token.id,
        value: '#007bff',
        type: 'invariant',
        componentId: component.id,
        designSystemId: designSystem.id
      });

      const response = await request(app)
        .post(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`)
        .send({
          tokenValues: [
            { tokenId: token.id, value: '#28a745' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Invariant token values added/updated successfully');
      expect(response.body).toHaveProperty('created', 0);
      expect(response.body).toHaveProperty('updated', 1);

      // Verify token value was updated
      const [tokenValue] = await testDb.select().from(tokenValues)
        .where(eq(tokenValues.componentId, component.id));
      expect(tokenValue).toBeDefined();
      expect(tokenValue?.value).toBe('#28a745');
    });

    it('should handle multiple token values', async () => {
      // Create test design system, component and tokens
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token1] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      const [token2] = await testDb.insert(tokens).values({
        name: 'buttonSize',
        type: 'size',
        componentId: component.id
      }).returning();

      const response = await request(app)
        .post(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`)
        .send({
          tokenValues: [
            { tokenId: token1.id, value: '#007bff' },
            { tokenId: token2.id, value: '16px' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('created', 2);
      expect(response.body).toHaveProperty('updated', 0);

      // Verify both token values were created
      const tokenValuesResult = await testDb.select().from(tokenValues)
        .where(eq(tokenValues.componentId, component.id));
      expect(tokenValuesResult).toHaveLength(2);
    });
  });

  describe('DELETE /api/components/:id/invariants/:tokenValueId', () => {
    it('should delete invariant token value', async () => {
      // Create test design system, component, and token
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const [token] = await testDb.insert(tokens).values({
        name: 'buttonColor',
        type: 'color',
        componentId: component.id
      }).returning();

      // First create an invariant token value
      const createResponse = await request(app)
        .post(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`)
        .send({
          tokenValues: [
            { tokenId: token.id, value: '#007bff' }
          ]
        });

      expect(createResponse.status).toBe(200);
      const tokenValueId = createResponse.body.created > 0 ? 
        createResponse.body.tokenValues[0].id : 
        createResponse.body.tokenValues[0].id;

      // Now delete it
      const deleteResponse = await request(app)
        .delete(`/api/components/${component.id}/invariants/${tokenValueId}?designSystemId=${designSystem.id}`);

      expect(deleteResponse.status).toBe(204);

      // Verify it's deleted by trying to fetch invariants
      const getResponse = await request(app)
        .get(`/api/components/${component.id}/invariants?designSystemId=${designSystem.id}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveLength(0);
    });

    it('should return 404 for non-existent component', async () => {
      const response = await request(app)
        .delete('/api/components/999/invariants/1?designSystemId=1');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Component not found');
    });

    it('should return 404 for non-existent invariant token value', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const response = await request(app)
        .delete(`/api/components/${component.id}/invariants/999?designSystemId=${designSystem.id}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Invariant token value not found');
    });

    it('should return 400 for invalid component ID', async () => {
      const response = await request(app)
        .delete('/api/components/invalid/invariants/1?designSystemId=1');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid component ID, token value ID, or design system ID');
    });

    it('should return 400 for invalid token value ID', async () => {
      // Create test design system and component
      const [designSystem] = await testDb.insert(designSystems).values({
        name: 'Test Design System',
        description: 'Test design system',
        projectName: "Test 66",
        grayTone: "warmGray",
        accentColor: "arctic",
        lightStrokeSaturation: 700,
        lightFillSaturation: 600,
        darkStrokeSaturation: 400,
        darkFillSaturation: 400,
      }).returning();

      const [component] = await testDb.insert(components).values({
        name: 'Button',
        description: 'Button component'
      }).returning();

      const response = await request(app)
        .delete(`/api/components/${component.id}/invariants/invalid?designSystemId=${designSystem.id}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid component ID, token value ID, or design system ID');
    });
  });
}); 