import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createPropsAPIRouter } from '../props-api';
import { testDb } from '../../../test/setup';
import { components, propsAPI } from '../../../db/schema';

const app = express();
app.use(express.json({ limit: '50mb' }));

let router: ReturnType<typeof createPropsAPIRouter>;

beforeAll(() => {
  router = createPropsAPIRouter(testDb);
  app.use('/admin-api/props-api', router);
});

describe('PropsAPI Endpoints', () => {
  let componentId: number;

  beforeEach(async () => {
    // Clear tables in proper order due to foreign key constraints
    await testDb.delete(propsAPI);
    await testDb.delete(components);
    
    // Create a test component first
    const [component] = await testDb.insert(components).values({
      name: 'TestComponent',
      description: 'A test component'
    }).returning();
    componentId = component.id;
  });

  describe('POST /admin-api/props-api', () => {
    it('should create a new propsAPI item', async () => {
      const propsAPIData = {
        componentId,
        name: 'disabled',
        value: 'false'
      };

      const response = await request(app)
        .post('/admin-api/props-api')
        .send(propsAPIData)
        .expect(201);

      expect(response.body).toMatchObject({
        componentId,
        name: 'disabled',
        value: 'false'
      });
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/admin-api/props-api')
        .send({ componentId })
        .expect(400);

      expect(response.body.error).toBe('componentId, name, and value are required');
    });

    it('should return 400 if component does not exist', async () => {
      const propsAPIData = {
        componentId: 999999,
        name: 'disabled',
        value: 'false'
      };

      const response = await request(app)
        .post('/admin-api/props-api')
        .send(propsAPIData)
        .expect(400);

      expect(response.body.error).toBe('Component not found');
    });

    it('should return 400 if propsAPI with same name already exists for component', async () => {
      const propsAPIData = {
        componentId,
        name: 'disabled',
        value: 'false'
      };

      // Create first propsAPI
      await request(app)
        .post('/admin-api/props-api')
        .send(propsAPIData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/admin-api/props-api')
        .send(propsAPIData)
        .expect(400);

      expect(response.body.error).toBe('PropsAPI with this name already exists for this component');
    });
  });

  describe('GET /admin-api/props-api/component/:componentId', () => {
    beforeEach(async () => {
      // Create some test propsAPI items
      await testDb.insert(propsAPI).values([
        { componentId, name: 'disabled', value: 'false' },
        { componentId, name: 'loading', value: 'true' }
      ]);
    });

    it('should return all propsAPI for a component', async () => {
      const response = await request(app)
        .get(`/admin-api/props-api/component/${componentId}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        componentId,
        name: 'disabled',
        value: 'false'
      });
      expect(response.body[1]).toMatchObject({
        componentId,
        name: 'loading',
        value: 'true'
      });
    });

    it('should return 404 if component does not exist', async () => {
      const response = await request(app)
        .get('/admin-api/props-api/component/999999')
        .expect(404);

      expect(response.body.error).toBe('Component not found');
    });
  });

  describe('PUT /admin-api/props-api/:id', () => {
    let propsAPIId: number;

    beforeEach(async () => {
      const [propsAPIItem] = await testDb.insert(propsAPI).values({
        componentId,
        name: 'disabled',
        value: 'false'
      }).returning();
      propsAPIId = propsAPIItem.id;
    });

    it('should update propsAPI name', async () => {
      const response = await request(app)
        .put(`/admin-api/props-api/${propsAPIId}`)
        .send({ name: 'enabled' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: propsAPIId,
        componentId,
        name: 'enabled',
        value: 'false'
      });
    });

    it('should update propsAPI value', async () => {
      const response = await request(app)
        .put(`/admin-api/props-api/${propsAPIId}`)
        .send({ value: 'true' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: propsAPIId,
        componentId,
        name: 'disabled',
        value: 'true'
      });
    });

    it('should return 404 if propsAPI does not exist', async () => {
      const response = await request(app)
        .put('/admin-api/props-api/999999')
        .send({ name: 'enabled' })
        .expect(404);

      expect(response.body.error).toBe('PropsAPI not found');
    });
  });

  describe('DELETE /admin-api/props-api/:id', () => {
    let propsAPIId: number;

    beforeEach(async () => {
      const [propsAPIItem] = await testDb.insert(propsAPI).values({
        componentId,
        name: 'disabled',
        value: 'false'
      }).returning();
      propsAPIId = propsAPIItem.id;
    });

    it('should delete propsAPI', async () => {
      await request(app)
        .delete(`/admin-api/props-api/${propsAPIId}`)
        .expect(204);

      // Verify it's deleted
      const response = await request(app)
        .get(`/admin-api/props-api/${propsAPIId}`)
        .expect(404);
    });

    it('should return 404 if propsAPI does not exist', async () => {
      const response = await request(app)
        .delete('/admin-api/props-api/999999')
        .expect(404);

      expect(response.body.error).toBe('PropsAPI not found');
    });
  });
}); 