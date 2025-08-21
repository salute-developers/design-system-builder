import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import * as fs from 'fs-extra';
import * as path from 'path';
import { 
    DesignSystemData, 
    StoredDesignSystem, 
    ApiResponse, 
    HealthResponse,
    DesignSystemTuple 
} from './validation';
import { 
    validateRequest, 
    validateParams,
    DesignSystemDataSchema,
    DesignSystemParamsSchema,
    safeValidate,
    StoredDesignSystemSchema
} from './validation';

interface CustomError extends Error {
    type?: string;
    status?: number;
    statusCode?: number;
}

const createApp = (storageDir?: string): Application => {
    const app: Application = express();
    
    // Use provided storage directory or default
    const STORAGE_DIR = storageDir || path.join(__dirname, '../storage');

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Ensure storage directory exists
    fs.ensureDirSync(STORAGE_DIR);

    // Helper function to get file path for a design system
    const getFilePath = (name: string, version: string): string => {
        const fileName = `${name}@${version}.json`;
        return path.join(STORAGE_DIR, fileName);
    };

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
            const { name, version, themeData, componentsData } = req.body;

            const data: StoredDesignSystem = {
                themeData,
                componentsData,
                savedAt: new Date().toISOString()
            };

            const filePath = getFilePath(name, version);
            await fs.writeJson(filePath, data, { spaces: 2 });

            console.log(`Saved design system: ${name}@${version}`);
            res.json({ 
                success: true, 
                message: `Design system ${name}@${version} saved successfully` 
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
            const { name, version } = req.params;
            const filePath = getFilePath(name, version);

            if (!await fs.pathExists(filePath)) {
                res.status(404).json({ 
                    error: 'Design system not found' 
                });
                return;
            }

            const rawData = await fs.readJson(filePath);
            
            // Validate loaded data
            const validation = safeValidate(StoredDesignSystemSchema, rawData);
            if (!validation.success) {
                console.error(`Invalid stored data for ${name}@${version}:`, validation.errors);
                res.status(500).json({
                    error: 'Stored data is corrupted',
                    details: 'The stored design system data does not match expected format'
                });
                return;
            }

            const data = validation.data!;
            console.log(`Loaded design system: ${name}@${version}`);
            res.json({
                themeData: data.themeData,
                componentsData: data.componentsData
            });

        } catch (error) {
            console.error('Error loading design system:', error);
            const err = error as Error;
            res.status(500).json({ 
                error: 'Failed to load design system',
                details: err.message 
            });
        }
    });

    // List all design systems
    app.get('/api/design-systems', async (req: Request, res: Response<DesignSystemTuple[] | ApiResponse>): Promise<void> => {
        try {
            const files = await fs.readdir(STORAGE_DIR);
            const designSystems: DesignSystemTuple[] = files
                .filter((file: string) => file.endsWith('.json'))
                .map((file: string) => {
                    const nameVersion = file.replace('.json', '');
                    const [name, version] = nameVersion.split('@');
                    return [name, version] as const;
                })
                .filter((tuple): tuple is DesignSystemTuple => {
                    const [name, version] = tuple;
                    return !!name && !!version;
                });

            if (designSystems.length === 0) {
                res.status(200).end();
                return;
            }

            console.log(`Listed ${designSystems.length} design systems`);
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
            const { name, version } = req.params;
            const filePath = getFilePath(name, version);

            if (!await fs.pathExists(filePath)) {
                res.status(404).json({ 
                    error: 'Design system not found' 
                });
                return;
            }

            await fs.remove(filePath);
            
            console.log(`Deleted design system: ${name}@${version}`);
            res.json({ 
                success: true, 
                message: `Design system ${name}@${version} deleted successfully` 
            });

        } catch (error) {
            console.error('Error deleting design system:', error);
            const err = error as Error;
            res.status(500).json({ 
                error: 'Failed to delete design system',
                details: err.message 
            });
        }
    });

    // Error handling middleware
    app.use((err: CustomError, req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
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

    // 404 handler
    app.use((req: Request, res: Response<ApiResponse>) => {
        res.status(404).json({ 
            error: 'Endpoint not found',
            path: req.path 
        });
    });

    return app;
};

export default createApp;
