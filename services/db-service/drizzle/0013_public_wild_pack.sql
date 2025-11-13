ALTER TABLE "design_systems" ADD COLUMN "project_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "gray_tone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "accent_color" text NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "light_stroke_saturation" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "light_fill_saturation" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "dark_stroke_saturation" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "design_systems" ADD COLUMN "dark_fill_saturation" integer NOT NULL;