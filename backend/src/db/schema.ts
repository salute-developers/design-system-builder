import { pgTable, serial, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// DesignSystem table
export const designSystems = pgTable('design_systems', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  owner: text('owner').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Component table
export const components = pgTable('components', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Variation table
export const variations = pgTable('variations', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Token table
export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  defaultValue: text('default_value'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// TokenValue table
export const tokenValues = pgTable('token_values', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').references(() => tokens.id),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// VariationValue table
export const variationValues = pgTable('variation_values', {
  id: serial('id').primaryKey(),
  variationId: integer('variation_id').references(() => variations.id),
  value: text('value').notNull(),
  tokenValues: jsonb('token_values').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ComponentValue table
export const componentValues = pgTable('component_values', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id),
  variationValues: jsonb('variation_values').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const componentsRelations = relations(components, ({ many }) => ({
  variations: many(variations),
  componentValues: many(componentValues),
}));

export const variationsRelations = relations(variations, ({ one, many }) => ({
  component: one(components, {
    fields: [variations.componentId],
    references: [components.id],
  }),
  variationValues: many(variationValues),
}));

export const tokensRelations = relations(tokens, ({ many }) => ({
  tokenValues: many(tokenValues),
}));

export const tokenValuesRelations = relations(tokenValues, ({ one }) => ({
  token: one(tokens, {
    fields: [tokenValues.tokenId],
    references: [tokens.id],
  }),
}));

export const variationValuesRelations = relations(variationValues, ({ one }) => ({
  variation: one(variations, {
    fields: [variationValues.variationId],
    references: [variations.id],
  }),
}));

export const componentValuesRelations = relations(componentValues, ({ one }) => ({
  component: one(components, {
    fields: [componentValues.componentId],
    references: [components.id],
  }),
})); 