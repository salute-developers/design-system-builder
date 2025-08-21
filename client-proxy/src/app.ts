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

interface CustomError extends Error {
    type?: string;
    status?: number;
    statusCode?: number;
}

const createApp = (storageDir?: string): Application => {
    const app: Application = express();
    
    // Use provided storage directory or default
    const STORAGE_DIR = storageDir || path.join(__dirname, '../storage');

    // Create store instance
    const store = createStore(STORAGE_DIR);

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Health check endpoint
    app.get('/health', (req: Request, res: Response<HealthResponse>) => {
        res.json({ status: 'ok', message: 'Client proxy server is running' });
    });

    // Save design system with validation
    app.post('/api/design-systems', 
        validateRequest(DesignSystemDataSchema),
        async (req: Request<{}, ApiResponse, DesignSystemData>, res: Response<ApiResponse>): Promise<void> => {
        try {
            // Request body is already validated by Zod middleware
            const designSystemData = req.body;

            await store.saveDesignSystem(designSystemData);

            res.json({ 
                success: true, 
                message: `Design system ${designSystemData.name}@${designSystemData.version} saved successfully` 
            });

        } catch (error) {
            console.error('Error saving design system:', error);
            const err = error as Error;
            res.status(500).json({ 
                error: 'Failed to save design system',
                details: err.message 
            });
        }
    });

    // Load specific design system with parameter validation
    app.get('/api/design-systems/:name/:version', 
        validateParams(DesignSystemParamsSchema),
        async (req: Request<{ name: string; version: string }>, res: Response<Pick<DesignSystemData, 'themeData' | 'componentsData'> | ApiResponse>): Promise<void> => {
        try {
            const { name } = req.params;
            // const { name, version } = req.params;
            // TODO: Remove hardcoded version and use dynamic version from params
            const version = '0.1.0';

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
