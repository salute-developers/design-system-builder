import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
    DesignSystemData,
    StoredThemeData,
    StoredComponentsData,
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
    StoredThemeDataSchema,
    StoredComponentsDataSchema
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

    // Helper functions to get file paths for a design system
    const getThemeFilePath = (name: string, version: string): string => {
        const fileName = `${name}@${version}.theme.json`;
        return path.join(STORAGE_DIR, fileName);
    };

    const getComponentsFilePath = (name: string, version: string): string => {
        const fileName = `${name}@${version}.components.json`;
        return path.join(STORAGE_DIR, fileName);
    };

    // Helper function to get the base name for a design system
    const getBaseName = (name: string, version: string): string => {
        return `${name}@${version}`;
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

            const savedAt = new Date().toISOString();
            
            // Prepare data for separate files
            const themeFileData = {
                themeData,
                savedAt
            };

            const componentsFileData = {
                componentsData,
                savedAt
            };

            // Save to separate files
            const themeFilePath = getThemeFilePath(name, version);
            const componentsFilePath = getComponentsFilePath(name, version);
            
            await Promise.all([
                fs.writeJson(themeFilePath, themeFileData, { spaces: 2 }),
                fs.writeJson(componentsFilePath, componentsFileData, { spaces: 2 })
            ]);

            console.log(`Saved design system: ${name}@${version} (theme + components)`);
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
            const themeFilePath = getThemeFilePath(name, version);
            const componentsFilePath = getComponentsFilePath(name, version);

            // Check if both files exist
            const [themeExists, componentsExists] = await Promise.all([
                fs.pathExists(themeFilePath),
                fs.pathExists(componentsFilePath)
            ]);

            if (!themeExists || !componentsExists) {
                res.status(404).json({ 
                    error: 'Design system not found',
                    details: `Missing ${!themeExists ? 'theme' : ''}${!themeExists && !componentsExists ? ' and ' : ''}${!componentsExists ? 'components' : ''} data`
                });
                return;
            }

            // Load both files in parallel
            const [themeRawData, componentsRawData] = await Promise.all([
                fs.readJson(themeFilePath),
                fs.readJson(componentsFilePath)
            ]);
            
            // Validate loaded data from separate files
            const themeValidation = safeValidate(StoredThemeDataSchema, themeRawData);
            const componentsValidation = safeValidate(StoredComponentsDataSchema, componentsRawData);

            if (!themeValidation.success || !componentsValidation.success) {
                console.error(`Invalid stored data for ${name}@${version}:`, {
                    theme: themeValidation.success ? 'valid' : themeValidation.errors,
                    components: componentsValidation.success ? 'valid' : componentsValidation.errors
                });
                res.status(500).json({
                    error: 'Stored data is corrupted',
                    details: 'The stored design system data does not match expected format'
                });
                return;
            }

            const themeData = themeValidation.data!.themeData;
            const componentsData = componentsValidation.data!.componentsData;

            console.log(`Loaded design system: ${name}@${version} (theme + components)`);
            res.json({
                themeData,
                componentsData
            } as any);

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
            
            // Get unique design systems by looking for .theme.json files
            // and checking if corresponding .components.json exists
            const themeFiles = files.filter((file: string) => file.endsWith('.theme.json'));
            const designSystems: DesignSystemTuple[] = [];

            for (const themeFile of themeFiles) {
                const nameVersion = themeFile.replace('.theme.json', '');
                const [name, version] = nameVersion.split('@');
                
                if (name && version) {
                    // Check if corresponding components file exists
                    const componentsFile = `${nameVersion}.components.json`;
                    if (files.includes(componentsFile)) {
                        designSystems.push([name, version] as const);
                    }
                }
            }

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
            const themeFilePath = getThemeFilePath(name, version);
            const componentsFilePath = getComponentsFilePath(name, version);

            // Check if both files exist
            const [themeExists, componentsExists] = await Promise.all([
                fs.pathExists(themeFilePath),
                fs.pathExists(componentsFilePath)
            ]);

            if (!themeExists && !componentsExists) {
                res.status(404).json({ 
                    error: 'Design system not found' 
                });
                return;
            }

            // Remove both files (only remove existing ones)
            const removePromises = [];
            if (themeExists) {
                removePromises.push(fs.remove(themeFilePath));
            }
            if (componentsExists) {
                removePromises.push(fs.remove(componentsFilePath));
            }

            await Promise.all(removePromises);
            
            console.log(`Deleted design system: ${name}@${version} (theme + components)`);
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
