-- Saved queries were removed from db-service together with the NL query feature.
-- IF EXISTS covers databases where the legacy Drizzle migration already dropped the table.
DROP TABLE IF EXISTS "saved_queries" CASCADE;
