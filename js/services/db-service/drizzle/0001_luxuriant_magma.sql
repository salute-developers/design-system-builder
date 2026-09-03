CREATE UNIQUE INDEX "dsu_user_id_design_system_id_unique" ON "design_system_users" USING btree ("user_id","design_system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_systems_name_unique" ON "design_systems" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_component_id_name_unique" ON "properties" USING btree ("component_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "ppp_property_id_platform_name_unique" ON "property_platform_params" USING btree ("property_id","platform","name");--> statement-breakpoint
CREATE UNIQUE INDEX "styles_ds_id_variation_id_name_unique" ON "styles" USING btree ("design_system_id","variation_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "variations_component_id_name_unique" ON "variations" USING btree ("component_id","name");