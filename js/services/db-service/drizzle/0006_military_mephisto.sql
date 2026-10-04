DROP INDEX "tenants_design_system_id_name_unique";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "edit_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "tenants"
SET "name" = regexp_replace(btrim("name"), '\s+', ' ', 'g')
WHERE "name" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_design_system_id_name_ci_unique" ON "tenants" USING btree ("design_system_id",lower("name"));
