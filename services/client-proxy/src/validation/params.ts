import { z } from 'zod';

// URL parameter schemas
export const DesignSystemParamsSchema = z.object({
    name: z.string()
        .trim()
        .min(1, 'Design system name is required')
        .max(100, 'Design system name is too long')
        .regex(/^[a-zA-Z0-9\-_\s]+$/, 'Design system name contains invalid characters'),
    version: z.string()
        .trim()
        .min(1, 'Version is required')
        .max(50, 'Version is too long')
        .regex(/^[a-zA-Z0-9\.\-_]+$/, 'Version contains invalid characters'),
});

// Query parameter schemas (if needed in the future)
export const ListQuerySchema = z.object({
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    search: z.string().optional(),
}).optional();

// Export type inference
export type DesignSystemParams = z.infer<typeof DesignSystemParamsSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
