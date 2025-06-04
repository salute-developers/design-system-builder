import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDesignSystemsRouter } from '../design-systems';
import { testDb } from '../../../test/setup';
import { designSystems } from '../../../db/schema';

const app = express();
app.use(express.json());
app.use('/api/design-systems', createDesignSystemsRouter(testDb));

describe('Design Systems API', () => {
  beforeEach(async () => {
    // Clear the design systems table before each test
    await testDb.delete(designSystems);
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
}); 