import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';

import {
    DesignSystemData,
    ApiResponse,
    HealthResponse
} from './validation';
import {
    validateRequest,
    validateParams,
    DesignSystemDataSchema,
    DesignSystemParamsSchema
} from './validation';
import { createStore } from './store';
import { IndexStore } from './store/indexStore';
import { Logger } from './utils/logger';
// import { RequestLogger } from './utils/request-logger'; // DISABLED: Request/response logging

interface CustomError extends Error {
    type?: string;
    status?: number;
    statusCode?: number;
}

const createApp = (indexStore?: IndexStore, componentStore?: any): Application => {
    const app: Application = express();

    // Create store instance with optional mock index store and component store
    const store = createStore(indexStore, componentStore);

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    
    // Add request logging middleware to track duplicates
    app.use((req: Request, res: Response, next: NextFunction) => {
        const requestId = Math.random().toString(36).substring(7);
        req.headers['x-request-id'] = requestId;
        
        Logger.log(`📨 [${requestId}] ${req.method} ${req.path} - ${new Date().toISOString()}`);
        if (req.method === 'POST' && req.path === '/api/design-systems') {
            Logger.log(`📨 [${requestId}] POST to /api/design-systems - Body size: ${JSON.stringify(req.body || {}).length} chars`);
        }
        
        next();
    });

    // Add request/response logging middleware for specific endpoints
    // DISABLED: Request/response logging
    /*
    const logger = RequestLogger.getInstance();
    app.use((req: Request, res: Response, next: NextFunction) => {
        const shouldLog = (
            (req.method === 'POST' && req.path === '/api/design-systems') ||
            (req.method === 'GET' && req.path.match(/^\/api\/design-systems\/[^\/]+\/[^\/]+$/)) ||
            (req.method === 'GET' && req.path === '/api/design-systems') ||
            (req.method === 'DELETE' && req.path.match(/^\/api\/design-systems\/[^\/]+\/[^\/]+$/))
        );

        if (shouldLog) {
            // Log request
            logger.logRequest(
                req.method,
                req.originalUrl,
                req.headers as Record<string, string>,
                req.body
            );

            // Override res.json to capture response
            const originalJson = res.json;
            res.json = function(body: any) {
                logger.logResponse(
                    req.method,
                    req.originalUrl,
                    res.statusCode,
                    res.getHeaders() as Record<string, string>,
                    body
                );
                return originalJson.call(this, body);
            };

            // Override res.end to capture response for non-JSON responses
            const originalEnd = res.end;
            res.end = function(chunk?: any, encoding?: any) {
                if (chunk && !res.headersSent) {
                    logger.logResponse(
                        req.method,
                        req.originalUrl,
                        res.statusCode,
                        res.getHeaders() as Record<string, string>,
                        chunk.toString()
                    );
                }
                return originalEnd.call(this, chunk, encoding);
            };
        }

        next();
    });
    */

    // Health check endpoint
    app.get('/health', (req: Request, res: Response<HealthResponse>) => {
        res.json({ status: 'ok', message: 'Client proxy server is running' });
    });
    
    // Debug endpoint to test request logging
    app.post('/debug/test', (req: Request, res: Response) => {
        Logger.debug(`🔍 [DEBUG] Test endpoint hit`);
        Logger.debug(`🔍 [DEBUG] Request body:`, req.body);
        Logger.debug(`🔍 [DEBUG] Request headers:`, req.headers);
        res.json({ 
            message: 'Debug endpoint hit',
            body: req.body,
            headers: req.headers
        });
    });

    // Save design system with validation and transformation
    app.post('/api/design-systems', 
        validateRequest(DesignSystemDataSchema),
        async (req: Request<{}, ApiResponse, DesignSystemData>, res: Response<ApiResponse>): Promise<void> => {
        Logger.log(`🚀 [POST] /api/design-systems endpoint hit`);
        Logger.log(`🚀 [POST] Request body received:`, {
            name: req.body?.name,
            version: req.body?.version,
            hasThemeData: !!req.body?.themeData,
            componentsCount: req.body?.componentsData?.length,
            bodyKeys: Object.keys(req.body || {})
        });
        
        try {
            // Request body is already validated by Zod middleware
            const designSystemData = req.body;
            Logger.log(`✅ [POST] Validation passed, proceeding to save design system: ${designSystemData.name}@${designSystemData.version}`);

            // Use the enhanced DesignSystemStore which now handles transformation internally
            Logger.log(`🔄 [POST] Calling store.saveDesignSystem...`);
            await store.saveDesignSystem(designSystemData);
            Logger.log(`✅ [POST] store.saveDesignSystem completed successfully`);

            res.json({ 
                success: true, 
                message: `Design system ${designSystemData.name}@${designSystemData.version} saved successfully with transformation (${designSystemData.componentsData.length} components, theme: ${designSystemData.themeData ? 'present' : 'missing'})`
            });
            Logger.log(`✅ [POST] Response sent successfully`);

        } catch (error) {
            Logger.error('❌ [POST] Error saving design system:', error);
            const err = error as Error;
            res.status(500).json({ 
                error: 'Failed to save design system',
                details: err.message 
            });
        }
    });

    // Load specific design system with parameter validation and transformation
    app.get('/api/design-systems/:name/:version', 
        validateParams(DesignSystemParamsSchema),
        async (req: Request<{ name: string; version: string }>, res: Response<Pick<DesignSystemData, 'themeData' | 'componentsData'> | ApiResponse>): Promise<void> => {
        try {
            const { name } = req.params;
            // const { name, version } = req.params;
            // TODO: Remove hardcoded version and use dynamic version from params
            const version = '0.1.0';

            // Use the enhanced DesignSystemStore which now handles transformation internally
            const { themeData, componentsData } = await store.loadDesignSystem(name, version);

            res.json({
                themeData,
                componentsData
            } as any);

        } catch (error) {
            Logger.error('Error loading design system:', error);
            const err = error as Error;
            
            if (err.message.includes('Missing') || err.message.includes('not found')) {
                res.status(404).json({ 
                    error: 'Design system not found',
                    details: err.message 
                });
            } else if (err.message.includes('does not match expected format')) {
                res.status(500).json({
                    error: 'Stored data is corrupted',
                    details: 'The stored design system data does not match expected format'
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to load design system',
                    details: err.message 
                });
            }
        }
    });

    // List all design systems
    app.get('/api/design-systems', async (req: Request, res: Response<any>): Promise<void> => {
        try {
            const designSystems = await store.listDesignSystems();

            if (designSystems.length === 0) {
                res.status(200).end();
                return;
            }

            res.json(designSystems);

        } catch (error) {
            Logger.error('Error listing design systems:', error);
            const err = error as Error;
            res.status(500).json({ 
                error: 'Failed to list design systems',
                details: err.message 
            });
        }
    });

    // Delete design system with parameter validation
    app.delete('/api/design-systems/:name/:version', 
        validateParams(DesignSystemParamsSchema),
        async (req: Request<{ name: string; version: string }>, res: Response<ApiResponse>): Promise<void> => {
        try {
            const { name } = req.params;
            // const { name, version } = req.params;
            // TODO: Remove hardcoded version and use dynamic version from params
            const version = '0.1.0';

            await store.deleteDesignSystem(name, version);
            
            res.json({ 
                success: true, 
                message: `Design system ${name}@${version} deleted successfully` 
            });

        } catch (error) {
            Logger.error('Error deleting design system:', error);
            const err = error as Error;
            
            if (err.message.includes('not found')) {
                res.status(404).json({ 
                    error: 'Design system not found',
                    details: err.message 
                });
            } else {
                res.status(500).json({ 
                    error: 'Failed to delete design system',
                    details: err.message 
                });
            }
        }
    });

    // 404 handler - must come before error handler
    app.use((req: Request, res: Response<ApiResponse>) => {
        res.status(404).json({ 
            error: 'Endpoint not found',
            path: req.path 
        });
    });

    // Error handling middleware
    app.use((err: CustomError, _req: Request, res: Response<ApiResponse>, _next: NextFunction): void => {
        // Handle JSON parsing errors
        if (err.type === 'entity.parse.failed') {
            res.status(400).json({
                error: 'Invalid JSON in request body',
                details: err.message
            });
            return;
        }

        Logger.error('Unhandled error:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message 
        });
    });

    return app;
};

export default createApp;
