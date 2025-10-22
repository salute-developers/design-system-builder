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

export const TokenStateSchema = z.object({
  state: z.array(z.string().min(1, "State cannot be empty")),
  value: z.string().min(1, "Value is required"),
});

// Token Value schemas
export const TokenValueSchema = z.object({
  tokenId: z.number().int().positive('Token ID must be a positive integer'),
  value: z.string().trim(), // Allow empty strings, backend will filter them out
  states: z.array(TokenStateSchema)
    .default([])
    .optional(),
});

// Variation Value schemas
export const CreateVariationValueSchema = z.object({
  designSystemId: z.number().int().positive('Design system ID must be a positive integer'),
  componentId: z.number().int().positive('Component ID must be a positive integer'),
  variationId: z.number().int().positive('Variation ID must be a positive integer'),
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional(),
  isDefaultValue: z.boolean().optional().default(false),
  tokenValues: z.array(TokenValueSchema).optional()
});

export const UpdateVariationValueSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().trim().max(1000, 'Description must be less than 1000 characters').optional(),
  isDefaultValue: z.boolean().optional(),
  tokenValues: z.array(TokenValueSchema).optional()
});

// Component Invariant Token Value schemas
export const AddInvariantTokenValuesSchema = z.object({
  tokenValues: z.array(z.object({
    tokenId: z.number().int().positive('Token ID must be a positive integer'),
    value: z.string().trim().min(1, 'Value is required').max(1000, 'Value must be less than 1000 characters')
  })).min(1, 'At least one token value is required')
});

// Theme schemas
export const CreateThemeSchema = z.object({
  designSystemId: z.number().int().positive('Design system ID must be a positive integer'),
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  version: z.string().trim().min(1, 'Version is required').max(50, 'Version must be less than 50 characters'),
  themeData: z.any() // JSONB field - can be any valid JSON
});

export const UpdateThemeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be less than 255 characters').optional(),
  version: z.string().trim().min(1, 'Version is required').max(50, 'Version must be less than 50 characters').optional(),
  themeData: z.any().optional() // JSONB field - can be any valid JSON
});

export const ThemeParamsSchema = z.object({
  designSystemId: z.string().regex(/^\d+$/, 'Design system ID must be a valid number'),
  name: z.string().min(1, 'Name is required'),
  version: z.string().min(1, 'Version is required')
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
export type AddInvariantTokenValuesRequest = z.infer<typeof AddInvariantTokenValuesSchema>;
export type CreateThemeRequest = z.infer<typeof CreateThemeSchema>;
export type UpdateThemeRequest = z.infer<typeof UpdateThemeSchema>;
export type ThemeParams = z.infer<typeof ThemeParamsSchema>;
