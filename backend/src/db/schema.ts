import { pgTable, serial, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// version: text('version').notNull(),
// owner: text('owner').notNull(),
// config: jsonb('config').notNull(),

// Design System table
export const designSystems = pgTable('design_systems', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
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

// Design System Components junction table
export const designSystemComponents = pgTable('design_system_components', {
  id: serial('id').primaryKey(),
  designSystemId: integer('design_system_id').references(() => designSystems.id).notNull(),
  componentId: integer('component_id').references(() => components.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Variation table
export const variations = pgTable('variations', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Token table
export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  variationId: integer('variation_id').references(() => variations.id).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  defaultValue: text('default_value'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Variation Value table
export const variationValues = pgTable('variation_values', {
  id: serial('id').primaryKey(),
  designSystemId: integer('design_system_id').references(() => designSystems.id).notNull(),
  componentId: integer('component_id').references(() => components.id).notNull(),
  variationId: integer('variation_id').references(() => variations.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Token Value table
export const tokenValues = pgTable('token_values', {
  id: serial('id').primaryKey(),
  variationValueId: integer('variation_value_id').references(() => variationValues.id).notNull(),
  tokenId: integer('token_id').references(() => tokens.id).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const designSystemsRelations = relations(designSystems, ({ many }) => ({
  components: many(designSystemComponents),
  variationValues: many(variationValues),
}));

export const componentsRelations = relations(components, ({ many }) => ({
  designSystems: many(designSystemComponents),
  variations: many(variations, { relationName: 'componentVariations' }),
  variationValues: many(variationValues),
}));

export const designSystemComponentsRelations = relations(designSystemComponents, ({ one }) => ({
  designSystem: one(designSystems, {
    fields: [designSystemComponents.designSystemId],
    references: [designSystems.id],
  }),
  component: one(components, {
    fields: [designSystemComponents.componentId],
    references: [components.id],
  }),
}));

export const variationsRelations = relations(variations, ({ one, many }) => ({
  component: one(components, {
    fields: [variations.componentId],
    references: [components.id],
    relationName: 'componentVariations',
  }),
  tokens: many(tokens),
  variationValues: many(variationValues),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  variation: one(variations, {
    fields: [tokens.variationId],
    references: [variations.id],
  }),
  tokenValues: many(tokenValues),
}));

export const variationValuesRelations = relations(variationValues, ({ one, many }) => ({
  designSystem: one(designSystems, {
    fields: [variationValues.designSystemId],
    references: [designSystems.id],
  }),
  component: one(components, {
    fields: [variationValues.componentId],
    references: [components.id],
  }),
  variation: one(variations, {
    fields: [variationValues.variationId],
    references: [variations.id],
  }),
  tokenValues: many(tokenValues),
}));

export const tokenValuesRelations = relations(tokenValues, ({ one }) => ({
  variationValue: one(variationValues, {
    fields: [tokenValues.variationValueId],
    references: [variationValues.id],
  }),
  token: one(tokens, {
    fields: [tokenValues.tokenId],
    references: [tokens.id],
  }),
}));