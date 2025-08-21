const request = require('supertest');
const path = require('path');
const fs = require('fs-extra');
const createApp = require('../app');
const { sampleDesignSystem, sampleDesignSystem2 } = require('./sample-data');

describe('Client Proxy API', () => {
    let app;
    let testStorageDir;

    beforeEach(() => {
        testStorageDir = process.env.TEST_STORAGE_DIR;
        app = createApp(testStorageDir);
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toEqual({
                status: 'ok',
                message: 'Client proxy server is running'
            });
        });
    });

    describe('POST /api/design-systems', () => {
        it('should save a design system successfully', async () => {
            const response = await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem)
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                message: 'Design system test-design-system@1.0.0 saved successfully'
            });

            // Verify file was created
            const filePath = path.join(testStorageDir, 'test-design-system@1.0.0.json');
            expect(await fs.pathExists(filePath)).toBe(true);

            // Verify file contents
            const savedData = await fs.readJson(filePath);
            expect(savedData.themeData).toEqual(sampleDesignSystem.themeData);
            expect(savedData.componentsData).toEqual(sampleDesignSystem.componentsData);
            expect(savedData.savedAt).toBeDefined();
        });

        it('should return 400 if name is missing', async () => {
            const invalidData = { ...sampleDesignSystem };
            delete invalidData.name;

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toEqual({
                error: 'Name and version are required'
            });
        });

        it('should return 400 if version is missing', async () => {
            const invalidData = { ...sampleDesignSystem };
            delete invalidData.version;

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toEqual({
                error: 'Name and version are required'
            });
        });

        it('should handle large design systems', async () => {
            // Create a large design system with many tokens
            const largeDesignSystem = {
                ...sampleDesignSystem,
                name: 'large-design-system',
                themeData: {
                    ...sampleDesignSystem.themeData,
                    meta: {
                        ...sampleDesignSystem.themeData.meta,
                        tokens: Array.from({ length: 1000 }, (_, i) => ({
                            type: 'color',
                            name: `color.${i}`,
                            tags: ['color', `${i}`],
                            displayName: `color${i}`,
                            description: `Color token ${i}`,
                            enabled: true
                        }))
                    }
                }
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(largeDesignSystem)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/design-systems/:name/:version', () => {
        beforeEach(async () => {
            // Save a design system for testing
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);
        });

        it('should load an existing design system', async () => {
            const response = await request(app)
                .get('/api/design-systems/test-design-system/1.0.0')
                .expect(200);

            expect(response.body.themeData).toEqual(sampleDesignSystem.themeData);
            expect(response.body.componentsData).toEqual(sampleDesignSystem.componentsData);
        });

        it('should return 404 for non-existent design system', async () => {
            const response = await request(app)
                .get('/api/design-systems/non-existent/1.0.0')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Design system not found'
            });
        });

        it('should handle URL encoded names and versions', async () => {
            const designSystemWithSpecialChars = {
                ...sampleDesignSystem,
                name: 'my-design system',
                version: '1.0.0-beta'
            };

            await request(app)
                .post('/api/design-systems')
                .send(designSystemWithSpecialChars);

            const response = await request(app)
                .get('/api/design-systems/my-design%20system/1.0.0-beta')
                .expect(200);

            expect(response.body.themeData).toEqual(designSystemWithSpecialChars.themeData);
        });
    });

    describe('GET /api/design-systems', () => {
        it('should return empty response when no design systems exist', async () => {
            const response = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(response.text).toBe('');
        });

        it('should list all design systems', async () => {
            // Save multiple design systems
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);

            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem2);

            const response = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(response.body).toEqual([
                ['another-design-system', '2.0.0'],
                ['test-design-system', '1.0.0']
            ]);
        });

        it('should ignore non-JSON files in storage directory', async () => {
            // Create a non-JSON file
            await fs.writeFile(path.join(testStorageDir, 'not-a-design-system.txt'), 'some content');
            
            // Save a valid design system
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);

            const response = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(response.body).toEqual([
                ['test-design-system', '1.0.0']
            ]);
        });

        it('should handle malformed filenames gracefully', async () => {
            // Create files with malformed names
            await fs.writeJson(path.join(testStorageDir, 'invalid-name.json'), {});
            await fs.writeJson(path.join(testStorageDir, 'no-version@.json'), {});
            await fs.writeJson(path.join(testStorageDir, '@no-name.json'), {});
            
            // Save a valid design system
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);

            const response = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(response.body).toEqual([
                ['test-design-system', '1.0.0']
            ]);
        });
    });

    describe('DELETE /api/design-systems/:name/:version', () => {
        beforeEach(async () => {
            // Save a design system for testing
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);
        });

        it('should delete an existing design system', async () => {
            const response = await request(app)
                .delete('/api/design-systems/test-design-system/1.0.0')
                .expect(200);

            expect(response.body).toEqual({
                success: true,
                message: 'Design system test-design-system@1.0.0 deleted successfully'
            });

            // Verify file was deleted
            const filePath = path.join(testStorageDir, 'test-design-system@1.0.0.json');
            expect(await fs.pathExists(filePath)).toBe(false);
        });

        it('should return 404 when trying to delete non-existent design system', async () => {
            const response = await request(app)
                .delete('/api/design-systems/non-existent/1.0.0')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Design system not found'
            });
        });

        it('should handle URL encoded names and versions', async () => {
            const designSystemWithSpecialChars = {
                ...sampleDesignSystem,
                name: 'my-design system',
                version: '1.0.0-beta'
            };

            await request(app)
                .post('/api/design-systems')
                .send(designSystemWithSpecialChars);

            const response = await request(app)
                .delete('/api/design-systems/my-design%20system/1.0.0-beta')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Error handling', () => {
        it('should return 404 for unknown endpoints', async () => {
            const response = await request(app)
                .get('/api/unknown-endpoint')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Endpoint not found',
                path: '/api/unknown-endpoint'
            });
        });

        it('should handle invalid JSON in request body', async () => {
            const response = await request(app)
                .post('/api/design-systems')
                .send('invalid json')
                .set('Content-Type', 'application/json')
                .expect(400);

            expect(response.body).toEqual({
                error: 'Invalid JSON in request body',
                details: expect.stringContaining('Unexpected token')
            });
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete CRUD operations', async () => {
            // Create
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem)
                .expect(200);

            // Read
            let response = await request(app)
                .get('/api/design-systems/test-design-system/1.0.0')
                .expect(200);
            
            expect(response.body.themeData).toEqual(sampleDesignSystem.themeData);

            // Update (save with same name/version)
            const updatedDesignSystem = {
                ...sampleDesignSystem,
                themeData: {
                    ...sampleDesignSystem.themeData,
                    meta: {
                        ...sampleDesignSystem.themeData.meta,
                        tokens: [
                            ...sampleDesignSystem.themeData.meta.tokens,
                            {
                                type: 'color',
                                name: 'new.token',
                                tags: ['new', 'token'],
                                displayName: 'newToken',
                                description: 'A new token',
                                enabled: true
                            }
                        ]
                    }
                }
            };

            await request(app)
                .post('/api/design-systems')
                .send(updatedDesignSystem)
                .expect(200);

            // Verify update
            response = await request(app)
                .get('/api/design-systems/test-design-system/1.0.0')
                .expect(200);
            
            expect(response.body.themeData.meta.tokens).toHaveLength(4);

            // Delete
            await request(app)
                .delete('/api/design-systems/test-design-system/1.0.0')
                .expect(200);

            // Verify deletion
            await request(app)
                .get('/api/design-systems/test-design-system/1.0.0')
                .expect(404);
        });

        it('should handle multiple design systems', async () => {
            // Save multiple design systems
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);

            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem2);

            // List all
            const listResponse = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(listResponse.body).toHaveLength(2);

            // Load each one
            const response1 = await request(app)
                .get('/api/design-systems/test-design-system/1.0.0')
                .expect(200);

            const response2 = await request(app)
                .get('/api/design-systems/another-design-system/2.0.0')
                .expect(200);

            expect(response1.body.themeData).toEqual(sampleDesignSystem.themeData);
            expect(response2.body.themeData).toEqual(sampleDesignSystem2.themeData);

            // Delete one
            await request(app)
                .delete('/api/design-systems/test-design-system/1.0.0')
                .expect(200);

            // Verify only one remains
            const finalListResponse = await request(app)
                .get('/api/design-systems')
                .expect(200);

            expect(finalListResponse.body).toEqual([
                ['another-design-system', '2.0.0']
            ]);
        });
    });
});
