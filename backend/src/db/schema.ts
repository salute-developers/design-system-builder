import { pgTable, serial, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// // DesignSystem table
// export const designSystems = pgTable('design_systems', {
//   id: serial('id').primaryKey(),
//   name: text('name').notNull(),
//   version: text('version').notNull(),
//   owner: text('owner').notNull(),
//   config: jsonb('config').notNull(),
//   createdAt: timestamp('created_at').defaultNow(),
//   updatedAt: timestamp('updated_at').defaultNow(),
// });

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

// Relations
export const componentsRelations = relations(components, ({ many }) => ({
  variations: many(variations),
}));

export const variationsRelations = relations(variations, ({ one, many }) => ({
  component: one(components, {
    fields: [variations.componentId],
    references: [components.id],
  }),
  tokens: many(tokens),
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
  variation: one(variations, {
    fields: [tokens.variationId],
    references: [variations.id],
  }),
}));