import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import * as path from 'path';
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

interface CustomError extends Error {
    type?: string;
    status?: number;
    statusCode?: number;
}

const createApp = (storageDir?: string, indexStore?: IndexStore): Application => {
    const app: Application = express();
    
    // Use provided storage directory or default
    const STORAGE_DIR = storageDir || path.join(__dirname, '../storage');

    // Create store instance with optional mock index store
    const store = createStore(STORAGE_DIR, indexStore);

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    
    // Add request logging middleware to track duplicates
    app.use((req: Request, res: Response, next: NextFunction) => {
        const requestId = Math.random().toString(36).substring(7);
        req.headers['x-request-id'] = requestId;
        
        console.log(`📨 [${requestId}] ${req.method} ${req.path} - ${new Date().toISOString()}`);
        if (req.method === 'POST' && req.path === '/api/design-systems') {
            console.log(`📨 [${requestId}] POST to /api/design-systems - Body size: ${JSON.stringify(req.body || {}).length} chars`);
        }
        
        next();
    });

    // Health check endpoint
    app.get('/health', (req: Request, res: Response<HealthResponse>) => {
        res.json({ status: 'ok', message: 'Client proxy server is running' });
    });
    
    // Debug endpoint to test request logging
    app.post('/debug/test', (req: Request, res: Response) => {
        console.log(`🔍 [DEBUG] Test endpoint hit`);
        console.log(`🔍 [DEBUG] Request body:`, req.body);
        console.log(`🔍 [DEBUG] Request headers:`, req.headers);
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
        console.log(`🚀 [POST] /api/design-systems endpoint hit`);
        console.log(`🚀 [POST] Request body received:`, {
            name: req.body?.name,
            version: req.body?.version,
            hasThemeData: !!req.body?.themeData,
            componentsCount: req.body?.componentsData?.length,
            bodyKeys: Object.keys(req.body || {})
        });
        
        try {
            // Request body is already validated by Zod middleware
            const designSystemData = req.body;
            console.log(`✅ [POST] Validation passed, proceeding to save design system: ${designSystemData.name}@${designSystemData.version}`);

            // Use the enhanced DesignSystemStore which now handles transformation internally
            console.log(`🔄 [POST] Calling store.saveDesignSystem...`);
            await store.saveDesignSystem(designSystemData);
            console.log(`✅ [POST] store.saveDesignSystem completed successfully`);

            res.json({ 
                success: true, 
                message: `Design system ${designSystemData.name}@${designSystemData.version} saved successfully with transformation (${designSystemData.componentsData.length} components, theme: ${designSystemData.themeData ? 'present' : 'missing'})`
            });
            console.log(`✅ [POST] Response sent successfully`);

        } catch (error) {
            console.error('❌ [POST] Error saving design system:', error);
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
            console.error('Error loading design system:', error);
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
            console.error('Error listing design systems:', error);
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
            console.error('Error deleting design system:', error);
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

        console.error('Unhandled error:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message 
        });
    });

    return app;
};

export default createApp;
