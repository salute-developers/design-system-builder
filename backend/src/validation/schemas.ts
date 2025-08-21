import { z } from 'zod';

// Base schemas for common patterns
export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid number')
});

export const PaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional()
}).optional();

// Design System schemas
export const CreateDesignSystemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional()
});

export const UpdateDesignSystemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional()
});

// Component schemas
export const AddComponentToDesignSystemSchema = z.object({
  designSystemId: z.number().int().positive('Design system ID must be a positive integer'),
  componentId: z.number().int().positive('Component ID must be a positive integer')
});

// Token Value schemas
export const TokenValueSchema = z.object({
  tokenId: z.number().int().positive('Token ID must be a positive integer'),
  value: z.string().trim().min(1, 'Value is required')
});

// Variation Value schemas
export const CreateVariationValueSchema = z.object({
  designSystemId: z.number().int().positive('Design system ID must be a positive integer'),
  componentId: z.number().int().positive('Component ID must be a positive integer'),
  variationId: z.number().int().positive('Variation ID must be a positive integer'),
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional(),
  tokenValues: z.array(TokenValueSchema).optional()
});

export const UpdateVariationValueSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional(),
  tokenValues: z.array(TokenValueSchema).optional()
});

// Export inferred types for use in route handlers
export type IdParam = z.infer<typeof IdParamSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type CreateDesignSystemRequest = z.infer<typeof CreateDesignSystemSchema>;
export type UpdateDesignSystemRequest = z.infer<typeof UpdateDesignSystemSchema>;
export type AddComponentToDesignSystemRequest = z.infer<typeof AddComponentToDesignSystemSchema>;
export type TokenValue = z.infer<typeof TokenValueSchema>;
export type CreateVariationValueRequest = z.infer<typeof CreateVariationValueSchema>;
export type UpdateVariationValueRequest = z.infer<typeof UpdateVariationValueSchema>;
