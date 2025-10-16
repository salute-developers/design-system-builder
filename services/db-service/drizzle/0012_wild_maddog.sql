CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_system_id" integer NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"theme_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "themes_design_system_id_name_version_unique" UNIQUE("design_system_id","name","version")
);
--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;