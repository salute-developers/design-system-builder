import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodIssue } from 'zod';
import { ApiResponse } from './schemas';
import { Logger } from '../utils/logger';

// Validation error response interface
interface ValidationErrorResponse extends ApiResponse {
    validationErrors?: Array<{
        path: string;
        message: string;
        code: string;
    }>;
}

// Generic validation middleware factory
export function validateRequest<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction): void => {
        Logger.debug(`🔍 [VALIDATION] Starting validation for ${req.method} ${req.path}`);
        Logger.debug(`🔍 [VALIDATION] Request body keys:`, Object.keys(req.body || {}));
        Logger.debug(`🔍 [VALIDATION] Request body preview:`, JSON.stringify(req.body, null, 2).substring(0, 500) + '...');
        
        try {
            // Validate request body
            Logger.debug(`🔍 [VALIDATION] Attempting to parse with schema...`);
            const validatedData = schema.parse(req.body);
            Logger.debug(`✅ [VALIDATION] Validation successful for ${req.method} ${req.path}`);
            
            // Replace req.body with validated data (ensures type safety)
            req.body = validatedData;
            
            next();
        } catch (error) {
            Logger.error(`❌ [VALIDATION] Validation failed for ${req.method} ${req.path}:`, error);
            
            if (error instanceof ZodError) {
                const validationErrors = error.issues.map((err: ZodIssue) => ({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                Logger.error(`❌ [VALIDATION] Zod validation errors:`, validationErrors);
                res.status(400).json({
                    error: 'Validation failed',
                    details: 'Request body does not match required schema',
                    validationErrors,
                });
                return;
            }

            // Handle unexpected validation errors
            Logger.error('Unexpected validation error:', error);
            res.status(500).json({
                error: 'Internal validation error',
                details: 'An unexpected error occurred during validation',
            });
        }
    };
}

// Validate query parameters
export function validateQuery<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction): void => {
        try {
            const validatedQuery = schema.parse(req.query);
            req.query = validatedQuery as any;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const validationErrors = error.issues.map((err: ZodIssue) => ({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                res.status(400).json({
                    error: 'Query validation failed',
                    details: 'Query parameters do not match required schema',
                    validationErrors,
                });
                return;
            }

            Logger.error('Unexpected query validation error:', error);
            res.status(500).json({
                error: 'Internal validation error',
                details: 'An unexpected error occurred during query validation',
            });
        }
    };
}

// Validate URL parameters
export function validateParams<T>(schema: z.ZodSchema<T>) {
    return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction): void => {
        try {
            const validatedParams = schema.parse(req.params);
            req.params = validatedParams as any;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const validationErrors = error.issues.map((err: ZodIssue) => ({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));

                res.status(400).json({
                    error: 'Parameter validation failed',
                    details: 'URL parameters do not match required schema',
                    validationErrors,
                });
                return;
            }

            Logger.error('Unexpected parameter validation error:', error);
            res.status(500).json({
                error: 'Internal validation error',
                details: 'An unexpected error occurred during parameter validation',
            });
        }
    };
}

// Utility function to safely validate data
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: Array<{
        path: string;
        message: string;
        code: string;
    }>;
} {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    } catch (error) {
        if (error instanceof ZodError) {
            return {
                success: false,
                errors: error.issues.map((err: ZodIssue) => ({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                })),
            };
        }
        
        return {
            success: false,
            errors: [{
                path: 'unknown',
                message: 'Unknown validation error',
                code: 'unknown_error',
            }],
        };
    }
}
