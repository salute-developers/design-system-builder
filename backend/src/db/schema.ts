import { pgTable, serial, text, timestamp, integer, unique, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  designSystemId: integer('design_system_id').references(() => designSystems.id, { onDelete: 'cascade' }).notNull(),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Variation table
export const variations = pgTable('variations', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Token table
export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }),
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

// Props API table
export const propsAPI = pgTable('props_api', {
  id: serial('id').primaryKey(),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(), // Will store string or boolean as text
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Variation Value table
export const variationValues = pgTable('variation_values', {
  id: serial('id').primaryKey(),
  designSystemId: integer('design_system_id').references(() => designSystems.id, { onDelete: 'cascade' }).notNull(),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }).notNull(),
  variationId: integer('variation_id').references(() => variations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isDefaultValue: text('is_default_value').default('false'), // 'true' or 'false' as string
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Token Value table - supports both variation and invariant tokens
export const tokenValues = pgTable('token_values', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').references(() => tokens.id, { onDelete: 'cascade' }).notNull(),
  value: text('value').notNull(),
  type: text('type').notNull().default('variation'), // 'variation' or 'invariant'
  states: jsonb('states').$type<{ state: string[]; value: string }[]>().default(sql`'[]'::jsonb`),
  
  // Conditional foreign keys based on type
  variationValueId: integer('variation_value_id').references(() => variationValues.id, { onDelete: 'cascade' }),
  componentId: integer('component_id').references(() => components.id, { onDelete: 'cascade' }),
  designSystemId: integer('design_system_id').references(() => designSystems.id, { onDelete: 'cascade' }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueVariationToken: unique().on(table.variationValueId, table.tokenId),
  uniqueInvariantToken: unique().on(table.designSystemId, table.componentId, table.tokenId),
}));

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
  invariantTokenValues: many(tokenValues, { relationName: 'designSystemInvariantTokenValues' }),
  themes: many(themes),
}));

export const componentsRelations = relations(components, ({ many }) => ({
  designSystems: many(designSystemComponents),
  variations: many(variations, { relationName: 'componentVariations' }),
  variationValues: many(variationValues),
  tokens: many(tokens),
  propsAPI: many(propsAPI),
  tokenValues: many(tokenValues),
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
  token: one(tokens, {
    fields: [tokenValues.tokenId],
    references: [tokens.id],
  }),
  // Conditional relations based on which foreign key is set
  variationValue: one(variationValues, {
    fields: [tokenValues.variationValueId],
    references: [variationValues.id],
  }),
  component: one(components, {
    fields: [tokenValues.componentId],
    references: [components.id],
  }),
  designSystem: one(designSystems, {
    fields: [tokenValues.designSystemId],
    references: [designSystems.id],
    relationName: 'designSystemInvariantTokenValues',
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

// Themes table
export const themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  designSystemId: integer('design_system_id').references(() => designSystems.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  themeData: jsonb('theme_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueThemeVersion: unique().on(table.designSystemId, table.name, table.version),
}));

export const propsAPIRelations = relations(propsAPI, ({ one }) => ({
  component: one(components, {
    fields: [propsAPI.componentId],
    references: [components.id],
  }),
}));

export const themesRelations = relations(themes, ({ one }) => ({
  designSystem: one(designSystems, {
    fields: [themes.designSystemId],
    references: [designSystems.id],
  }),
}));
