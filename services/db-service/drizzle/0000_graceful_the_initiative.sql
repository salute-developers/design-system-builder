CREATE TABLE "components" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"variation_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"default_value" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;