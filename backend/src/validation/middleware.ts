import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { z, ZodError, ZodIssue } from 'zod';

// Validation error response interface
interface ValidationErrorResponse {
  error: string;
  details: string;
  validationErrors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

// Helper function to format Zod errors
const formatZodErrors = (errors: ZodIssue[]) => {
  return errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
};

// Middleware to validate request body
export const validateBody = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error.issues);
        return res.status(400).json({
          error: 'Validation failed',
          details: 'Request body does not match required schema',
          validationErrors
        });
      }
      next(error);
    }
  };
};

// Middleware to validate URL parameters
export const validateParams = <T extends ParamsDictionary>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as ParamsDictionary;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error.issues);
        return res.status(400).json({
          error: 'Parameter validation failed',
          details: 'URL parameters do not match required schema',
          validationErrors
        });
      }
      next(error);
    }
  };
};

// Middleware to validate query parameters
export const validateQuery = <T extends ParsedQs>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as ParsedQs;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error.issues);
        return res.status(400).json({
          error: 'Query validation failed',
          details: 'Query parameters do not match required schema',
          validationErrors
        });
      }
      next(error);
    }
  };
};

// Utility function for safe validation (for testing or conditional validation)
export const safeValidate = <T>(schema: z.ZodSchema<T>, data: any) => {
  try {
    const parsedData = schema.parse(data);
    return { success: true as const, data: parsedData };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = formatZodErrors(error.issues);
      return { success: false as const, errors };
    }
    return { 
      success: false as const, 
      errors: [{ 
        path: 'unknown', 
        message: (error as Error).message, 
        code: 'unknown_error' 
      }] 
    };
  }
};
