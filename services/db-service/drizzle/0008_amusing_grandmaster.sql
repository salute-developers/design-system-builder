ALTER TABLE "token_values" ALTER COLUMN "variation_value_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "token_values" ADD COLUMN "type" text DEFAULT 'variation' NOT NULL;--> statement-breakpoint
ALTER TABLE "token_values" ADD COLUMN "component_id" integer;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_variation_value_id_token_id_unique" UNIQUE("variation_value_id","token_id");--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_component_id_token_id_unique" UNIQUE("component_id","token_id");