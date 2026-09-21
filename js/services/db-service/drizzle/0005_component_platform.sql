CREATE TYPE "public"."component_platform" AS ENUM('web', 'compose', 'ios');--> statement-breakpoint
DROP INDEX "appearances_design_system_id_component_id_name_unique";--> statement-breakpoint
ALTER TABLE "appearances" ADD COLUMN "platform" "component_platform";--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "platform" "component_platform";--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_ds_component_name_platform_unique" UNIQUE NULLS NOT DISTINCT("design_system_id","component_id","name","platform");