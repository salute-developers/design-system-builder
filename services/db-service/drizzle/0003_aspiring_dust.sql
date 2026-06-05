ALTER TABLE "design_system_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "design_system_changes" DROP CONSTRAINT IF EXISTS "design_system_changes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "design_system_versions" DROP CONSTRAINT IF EXISTS "design_system_versions_user_id_users_id_fk";--> statement-breakpoint
DROP TABLE "design_system_users" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "design_system_changes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "design_system_versions" DROP COLUMN "user_id";
