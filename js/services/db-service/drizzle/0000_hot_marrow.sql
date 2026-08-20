CREATE TYPE "public"."mode" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."operation" AS ENUM('created', 'updated', 'deleted', 'moved');--> statement-breakpoint
CREATE TYPE "public"."palette_type" AS ENUM('general', 'additional');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('web', 'android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."property_platform" AS ENUM('xml', 'compose', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('color', 'typography', 'shape', 'shadow', 'dimension', 'float');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('reuse', 'compose');--> statement-breakpoint
CREATE TYPE "public"."state" AS ENUM('pressed', 'hovered', 'focused', 'selected', 'readonly', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('color', 'gradient', 'typography', 'fontFamily', 'spacing', 'shape', 'shadow');--> statement-breakpoint
CREATE TABLE "appearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"name" text DEFAULT 'default',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_deps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"type" "relation_type" NOT NULL,
	"order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_reuse_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_dep_id" uuid NOT NULL,
	"design_system_id" uuid NOT NULL,
	"appearance_id" uuid NOT NULL,
	"variation_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_system_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"operation" "operation" NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_system_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_system_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"design_system_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_system_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"user_id" uuid,
	"version" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changelog" text,
	"publication_status" "publication_status",
	"published_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invariant_platform_param_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ipv_id" uuid NOT NULL,
	"platform_param_id" uuid NOT NULL,
	"value" text,
	"template" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invariant_property_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"design_system_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"appearance_id" uuid NOT NULL,
	"token_id" uuid,
	"value" text,
	"state" "state",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palette" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "palette_type" NOT NULL,
	"shade" text NOT NULL,
	"saturation" integer NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid,
	"name" text NOT NULL,
	"type" "property_type" NOT NULL,
	"default_value" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_platform_params" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"platform" "property_platform" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"variation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"sql" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_combination_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"combination_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_combinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"appearance_id" uuid NOT NULL,
	"value" text NOT NULL,
	"states" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"variation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"name" text,
	"description" text,
	"color_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid,
	"tenant_id" uuid,
	"palette_id" uuid,
	"platform" "platform",
	"mode" "mode",
	"value" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid,
	"name" text NOT NULL,
	"type" "token_type",
	"display_name" text,
	"description" text,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "variation_platform_param_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vpv_id" uuid NOT NULL,
	"platform_param_id" uuid NOT NULL,
	"value" text,
	"template" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variation_property_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"appearance_id" uuid NOT NULL,
	"token_id" uuid,
	"value" text,
	"state" "state",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_deps" ADD CONSTRAINT "component_deps_parent_id_components_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_deps" ADD CONSTRAINT "component_deps_child_id_components_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_reuse_configs" ADD CONSTRAINT "component_reuse_configs_component_dep_id_component_deps_id_fk" FOREIGN KEY ("component_dep_id") REFERENCES "public"."component_deps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_reuse_configs" ADD CONSTRAINT "component_reuse_configs_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_reuse_configs" ADD CONSTRAINT "component_reuse_configs_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_reuse_configs" ADD CONSTRAINT "component_reuse_configs_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_reuse_configs" ADD CONSTRAINT "component_reuse_configs_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_changes" ADD CONSTRAINT "design_system_changes_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_changes" ADD CONSTRAINT "design_system_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_components" ADD CONSTRAINT "design_system_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_users" ADD CONSTRAINT "design_system_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_users" ADD CONSTRAINT "design_system_users_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_versions" ADD CONSTRAINT "design_system_versions_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_system_versions" ADD CONSTRAINT "design_system_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentation_pages" ADD CONSTRAINT "documentation_pages_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_platform_param_adjustments" ADD CONSTRAINT "invariant_platform_param_adjustments_ipv_id_invariant_property_values_id_fk" FOREIGN KEY ("ipv_id") REFERENCES "public"."invariant_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_platform_param_adjustments" ADD CONSTRAINT "invariant_platform_param_adjustments_platform_param_id_property_platform_params_id_fk" FOREIGN KEY ("platform_param_id") REFERENCES "public"."property_platform_params"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_platform_params" ADD CONSTRAINT "property_platform_params_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_variations" ADD CONSTRAINT "property_variations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_variations" ADD CONSTRAINT "property_variations_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_combination_members" ADD CONSTRAINT "style_combination_members_combination_id_style_combinations_id_fk" FOREIGN KEY ("combination_id") REFERENCES "public"."style_combinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_combination_members" ADD CONSTRAINT "style_combination_members_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD CONSTRAINT "style_combinations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD CONSTRAINT "style_combinations_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_values" ADD CONSTRAINT "token_values_palette_id_palette_id_fk" FOREIGN KEY ("palette_id") REFERENCES "public"."palette"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_platform_param_adjustments" ADD CONSTRAINT "variation_platform_param_adjustments_vpv_id_variation_property_values_id_fk" FOREIGN KEY ("vpv_id") REFERENCES "public"."variation_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_platform_param_adjustments" ADD CONSTRAINT "variation_platform_param_adjustments_platform_param_id_property_platform_params_id_fk" FOREIGN KEY ("platform_param_id") REFERENCES "public"."property_platform_params"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appearances_design_system_id_component_id_name_unique" ON "appearances" USING btree ("design_system_id","component_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cd_parent_id_child_id_unique" ON "component_deps" USING btree ("parent_id","child_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crc_dep_ds_appearance_variation_unique" ON "component_reuse_configs" USING btree ("component_dep_id","design_system_id","appearance_id","variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "components_name_unique" ON "components" USING btree ("name");--> statement-breakpoint
CREATE INDEX "dsc_design_system_id_created_at_idx" ON "design_system_changes" USING btree ("design_system_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dsc_design_system_id_component_id_unique" ON "design_system_components" USING btree ("design_system_id","component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dsv_design_system_id_version_unique" ON "design_system_versions" USING btree ("design_system_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "documentation_pages_design_system_id_unique" ON "documentation_pages" USING btree ("design_system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ippa_ipv_platform_param_unique" ON "invariant_platform_param_adjustments" USING btree ("ipv_id","platform_param_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ipv_ds_comp_prop_app_no_state_unique" ON "invariant_property_values" USING btree ("design_system_id","component_id","property_id","appearance_id") WHERE state IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ipv_ds_comp_prop_app_state_unique" ON "invariant_property_values" USING btree ("design_system_id","component_id","property_id","appearance_id","state") WHERE state IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "palette_type_shade_saturation_unique" ON "palette" USING btree ("type","shade","saturation");--> statement-breakpoint
CREATE UNIQUE INDEX "pv_property_id_variation_id_unique" ON "property_variations" USING btree ("property_id","variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scm_combination_id_style_id_unique" ON "style_combination_members" USING btree ("combination_id","style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "styles_variation_id_ds_id_is_default_unique" ON "styles" USING btree ("variation_id","design_system_id") WHERE is_default = true;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_design_system_id_name_unique" ON "tenants" USING btree ("design_system_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tv_token_tenant_platform_no_mode_unique" ON "token_values" USING btree ("token_id","tenant_id","platform") WHERE mode IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tv_token_tenant_platform_mode_unique" ON "token_values" USING btree ("token_id","tenant_id","platform","mode") WHERE mode IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_design_system_id_name_unique" ON "tokens" USING btree ("design_system_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "vppa_vpv_platform_param_unique" ON "variation_platform_param_adjustments" USING btree ("vpv_id","platform_param_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vpv_style_property_appearance_no_state_unique" ON "variation_property_values" USING btree ("style_id","property_id","appearance_id") WHERE state IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vpv_style_property_appearance_state_unique" ON "variation_property_values" USING btree ("style_id","property_id","appearance_id","state") WHERE state IS NOT NULL;