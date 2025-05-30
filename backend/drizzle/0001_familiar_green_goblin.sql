CREATE TABLE "design_system_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_system_id" integer NOT NULL,
	"component_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "design_systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "token_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"variation_value_id" integer NOT NULL,
	"token_id" integer NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "variation_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_system_id" integer NOT NULL,
	"component_id" integer NOT NULL,
	"variation_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_variation_value_id_variation_values_id_fk" FOREIGN KEY ("variation_value_id") REFERENCES "public"."variation_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE no action ON UPDATE no action;