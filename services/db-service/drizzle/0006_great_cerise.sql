ALTER TABLE "design_system_components" DROP CONSTRAINT "design_system_components_design_system_id_design_systems_id_fk";
--> statement-breakpoint
ALTER TABLE "design_system_components" DROP CONSTRAINT "design_system_components_component_id_components_id_fk";
--> statement-breakpoint
ALTER TABLE "token_values" DROP CONSTRAINT "token_values_variation_value_id_variation_values_id_fk";
--> statement-breakpoint
ALTER TABLE "token_values" DROP CONSTRAINT "token_values_token_id_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "tokens" DROP CONSTRAINT "tokens_component_id_components_id_fk";
--> statement-breakpoint
ALTER TABLE "variation_values" DROP CONSTRAINT "variation_values_design_system_id_design_systems_id_fk";
--> statement-breakpoint
ALTER TABLE "variation_values" DROP CONSTRAINT "variation_values_component_id_components_id_fk";
--> statement-breakpoint
ALTER TABLE "variation_values" DROP CONSTRAINT "variation_values_variation_id_variations_id_fk";
--> statement-breakpoint
ALTER TABLE "variations" DROP CONSTRAINT "variations_component_id_components_id_fk";
--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_variation_value_id_variation_values_id_fk" FOREIGN KEY ("variation_value_id") REFERENCES "public"."variation_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_values" ADD CONSTRAINT "variation_values_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;