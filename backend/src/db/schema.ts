import { pgTable, serial, text, timestamp, integer, unique } from 'drizzle-orm/pg-core';
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
  componentId: integer('component_id').references(() => components.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  defaultValue: text('default_value'),
  description: text('description'),
  xmlParam: text('xml_param'),
  composeParam: text('compose_param'),
  iosParam: text('ios_param'),
  webParam: text('web_param'),
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

// Token-Variation junction table for many-to-many relationship
export const tokenVariations = pgTable('token_variations', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').references(() => tokens.id, { onDelete: 'cascade' }).notNull(),
  variationId: integer('variation_id').references(() => variations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueTokenVariation: unique().on(table.tokenId, table.variationId),
}));

// Relations
export const designSystemsRelations = relations(designSystems, ({ many }) => ({
  components: many(designSystemComponents),
  variationValues: many(variationValues),
}));

export const componentsRelations = relations(components, ({ many }) => ({
  designSystems: many(designSystemComponents),
  variations: many(variations, { relationName: 'componentVariations' }),
  variationValues: many(variationValues),
  tokens: many(tokens),
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
  variationValues: many(variationValues),
  tokenVariations: many(tokenVariations),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  component: one(components, {
    fields: [tokens.componentId],
    references: [components.id],
  }),
  tokenValues: many(tokenValues),
  tokenVariations: many(tokenVariations),
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

export const tokenVariationsRelations = relations(tokenVariations, ({ one }) => ({
  token: one(tokens, {
    fields: [tokenVariations.tokenId],
    references: [tokens.id],
  }),
  variation: one(variations, {
    fields: [tokenVariations.variationId],
    references: [variations.id],
  }),
}));