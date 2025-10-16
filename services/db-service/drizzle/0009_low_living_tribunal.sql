ALTER TABLE "token_values" DROP CONSTRAINT "token_values_component_id_token_id_unique";--> statement-breakpoint
ALTER TABLE "token_values" ADD COLUMN "design_system_id" integer;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_design_system_id_component_id_token_id_unique" UNIQUE("design_system_id","component_id","token_id");