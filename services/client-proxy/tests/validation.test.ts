import request from 'supertest';
import * as path from 'path';
import * as fs from 'fs-extra';
import { createTestApp } from './setup';
import { sampleDesignSystem } from './sample-data';
import { Application } from 'express';

describe('Validation Tests', () => {
    let app: Application;
    let testStorageDir: string;

    beforeEach(() => {
        testStorageDir = path.join(__dirname, 'test-storage', `test-${Date.now()}`);
        fs.ensureDirSync(testStorageDir);
        app = createTestApp(testStorageDir);
    });

    describe('POST /api/design-systems validation', () => {
        it('should reject request with missing name', async () => {
            const invalidData = { ...sampleDesignSystem };
            delete (invalidData as any).name;

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                details: 'Request body does not match required schema',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'name',
                        code: 'invalid_type'
                    })
                ])
            });
        });

        it('should reject request with empty name', async () => {
            const invalidData = { ...sampleDesignSystem, name: '' };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'name',
                        message: 'Name is required'
                    })
                ])
            });
        });

        it('should reject request with missing version', async () => {
            const invalidData = { ...sampleDesignSystem };
            delete (invalidData as any).version;

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'version',
                        code: 'invalid_type'
                    })
                ])
            });
        });

        it('should reject request with invalid themeData structure', async () => {
            const invalidData = {
                ...sampleDesignSystem,
                themeData: {
                    invalidField: 'invalid'
                }
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'themeData.meta'
                    })
                ])
            });
        });

        it('should reject request with invalid componentsData structure', async () => {
            const invalidData = {
                ...sampleDesignSystem,
                componentsData: [
                    {
                        name: 'Button',
                        // missing description and sources
                    }
                ]
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'componentsData.0.description'
                    }),
                    expect.objectContaining({
                        path: 'componentsData.0.sources'
                    })
                ])
            });
        });

        it('should reject request with invalid Sources structure', async () => {
            const invalidData = {
                ...sampleDesignSystem,
                componentsData: [
                    {
                        name: 'Button',
                        description: 'A button',
                        sources: {
                            // Wrong structure - should have api, variations, configs
                            web: 'ButtonWeb'
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'componentsData.0.sources.api'
                    })
                ])
            });
        });

        it('should reject request with invalid ComponentAPI structure', async () => {
            const invalidData = {
                ...sampleDesignSystem,
                componentsData: [
                    {
                        name: 'Button',
                        description: 'A button',
                        sources: {
                            api: [
                                {
                                    id: 'test',
                                    name: 'test',
                                    type: 'invalid_type', // Invalid PropType
                                    variations: null,
                                    platformMappings: {
                                        xml: null,
                                        compose: null,
                                        ios: null,
                                        web: null
                                    }
                                }
                            ],
                            variations: [],
                            configs: []
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'componentsData.0.sources.api.0.type'
                    })
                ])
            });
        });

        it('should accept valid design system data', async () => {
            const response = await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: expect.stringContaining('saved successfully')
            });
        });
    });

    describe('URL parameter validation', () => {
        beforeEach(async () => {
            // Save a valid design system for testing
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem);
        });

        it('should reject invalid design system name characters', async () => {
            const response = await request(app)
                .get('/api/design-systems/invalid@name/0.1.0')
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Parameter validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'name',
                        message: 'Design system name contains invalid characters'
                    })
                ])
            });
        });

        it('should reject design system name with only spaces', async () => {
            const response = await request(app)
                .get('/api/design-systems/%20%20%20/0.1.0') // URL encoded spaces
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Parameter validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'name',
                        message: 'Design system name is required'
                    })
                ])
            });
        });

        it('should reject invalid version characters', async () => {
            const response = await request(app)
                .get('/api/design-systems/test-design-system/invalid@version')
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Parameter validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: 'version',
                        message: 'Version contains invalid characters'
                    })
                ])
            });
        });

        it('should accept valid parameters', async () => {
            const response = await request(app)
                .get('/api/design-systems/test-design-system/0.1.0')
                .expect(200);

            expect(response.body).toHaveProperty('themeData');
            expect(response.body).toHaveProperty('componentsData');
        });

        it('should accept parameters with valid special characters', async () => {
            const designSystemWithSpecialChars = {
                ...sampleDesignSystem,
                name: 'my-design_system 2',
                version: '0.1.0'
            };

            await request(app)
                .post('/api/design-systems')
                .send(designSystemWithSpecialChars);

            const response = await request(app)
                .get('/api/design-systems/my-design_system%202/0.1.0')
                .expect(200);

            expect(response.body).toHaveProperty('themeData');
        });
    });

    describe('Data integrity validation', () => {
        beforeEach(async () => {
            // Clean up test storage before each test
            await fs.emptyDir(testStorageDir);
            app = createTestApp(testStorageDir);
        });

        it('should detect corrupted stored data', async () => {
            // Save valid data first
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem)
                .expect(200);

            // Manually corrupt the stored files
            const themeFilePath = path.join(testStorageDir, 'design-systems', 'test-design-system@0.1.0.theme.json');
            const componentsFilePath = path.join(testStorageDir, 'design-systems', 'test-design-system@0.1.0.components.json');
            await fs.writeJson(themeFilePath, {
                invalidData: 'corrupted',
                savedAt: new Date().toISOString()
            });
            await fs.writeJson(componentsFilePath, {
                invalidData: 'corrupted', 
                savedAt: new Date().toISOString()
            });

            const response = await request(app)
                .get('/api/design-systems/test-design-system/0.1.0')
                .expect(500);

            expect(response.body).toMatchObject({
                error: 'Stored data is corrupted',
                details: 'The stored design system data does not match expected format'
            });
        });

        it('should handle partially corrupted theme data', async () => {
            // Save valid data first
            await request(app)
                .post('/api/design-systems')
                .send(sampleDesignSystem)
                .expect(200);

            // Manually corrupt only the theme data
            const themeFilePath = path.join(testStorageDir, 'design-systems', 'test-design-system@0.1.0.theme.json');
            const themeData = await fs.readJson(themeFilePath);
            themeData.themeData.meta = { invalidMeta: true }; // Corrupt meta
            await fs.writeJson(themeFilePath, themeData);

            const response = await request(app)
                .get('/api/design-systems/test-design-system/0.1.0')
                .expect(500);

            expect(response.body).toMatchObject({
                error: 'Stored data is corrupted'
            });
        });
    });

    describe('Complex validation scenarios', () => {
        it('should validate nested component configuration', async () => {
            const complexData = {
                ...sampleDesignSystem,
                componentsData: [
                    {
                        name: 'Button',
                        description: 'A button component',
                        sources: {
                            api: [
                                {
                                    id: 'button-api',
                                    name: 'size',
                                    type: 'dimension' as const,
                                    variations: ['s', 'm', 'l'],
                                    platformMappings: {
                                        xml: null,
                                        compose: null,
                                        ios: null,
                                        web: [
                                            { name: 'padding', adjustment: '2px' },
                                            { name: 'fontSize', adjustment: null }
                                        ]
                                    }
                                }
                            ],
                            variations: [
                                { id: 'size-var', name: 'size' }
                            ],
                            configs: [
                                {
                                    name: 'Button',
                                    id: 'button-config',
                                    config: {
                                        defaultVariations: [
                                            { variationID: 'size-var', styleID: 'm' }
                                        ],
                                        invariantProps: [
                                            {
                                                id: 'border',
                                                value: '1px solid',
                                                states: [
                                                                                                                        {
                                                                        state: ['hovered'],
                                                                        value: '2px solid'
                                                                    }
                                                ]
                                            }
                                        ],
                                        variations: [
                                            {
                                                id: 'size-var',
                                                styles: [
                                                    {
                                                        name: 'Small',
                                                        id: 's',
                                                        intersections: { 'hover': ['active'] },
                                                        props: [
                                                            { id: 'padding', value: 8 }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(complexData)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should reject deeply nested invalid data', async () => {
            const invalidNestedData = {
                ...sampleDesignSystem,
                componentsData: [
                    {
                        name: 'Button',
                        description: 'A button component',
                        sources: {
                            api: [],
                            variations: [],
                            configs: [
                                {
                                    name: 'Button',
                                    id: 'button-config',
                                    config: {
                                        defaultVariations: [],
                                        invariantProps: [],
                                        variations: [
                                            {
                                                id: 'size-var',
                                                styles: [
                                                    {
                                                        name: 'Small',
                                                        id: 's',
                                                        intersections: null,
                                                        props: [
                                                            {
                                                                id: 'padding',
                                                                value: 'invalid_number_value', // Should be string or number
                                                                states: [
                                                                    {
                                                                        state: ['invalid_state'], // Should be 'hovered' or 'pressed'
                                                                        value: 'test'
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            };

            const response = await request(app)
                .post('/api/design-systems')
                .send(invalidNestedData)
                .expect(400);

            expect(response.body).toMatchObject({
                error: 'Validation failed',
                validationErrors: expect.arrayContaining([
                    expect.objectContaining({
                        path: expect.stringContaining('state.0')
                    })
                ])
            });
        });
    });
});
