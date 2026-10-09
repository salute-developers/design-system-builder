-- Source: 0000_hot_marrow.sql
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

-- Source: 0001_luxuriant_magma.sql
CREATE UNIQUE INDEX "dsu_user_id_design_system_id_unique" ON "design_system_users" USING btree ("user_id","design_system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_systems_name_unique" ON "design_systems" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_component_id_name_unique" ON "properties" USING btree ("component_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "ppp_property_id_platform_name_unique" ON "property_platform_params" USING btree ("property_id","platform","name");--> statement-breakpoint
CREATE UNIQUE INDEX "styles_ds_id_variation_id_name_unique" ON "styles" USING btree ("design_system_id","variation_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "variations_component_id_name_unique" ON "variations" USING btree ("component_id","name");

-- Source: 0002_low_ravenous.sql
ALTER TABLE "design_systems" ADD COLUMN "project_id" text;

-- Source: 0003_aspiring_dust.sql
ALTER TABLE "design_system_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "design_system_changes" DROP CONSTRAINT IF EXISTS "design_system_changes_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "design_system_versions" DROP CONSTRAINT IF EXISTS "design_system_versions_user_id_users_id_fk";--> statement-breakpoint
DROP TABLE "design_system_users" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "design_system_changes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "design_system_versions" DROP COLUMN "user_id";


-- Source: 0004_component_import.sql
ALTER TYPE "public"."property_type" ADD VALUE 'component_style';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'value';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'icon';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'boolean';--> statement-breakpoint
-- `gradient` и `blur` здесь не заводятся намеренно. Прежде они добавлялись, а следующая
-- миграция пересоздавала перечисление без них: `properties.type` — слот API, и оба этих
-- имени в нём не встречаются ни разу (замер: 40 файлов api-meta, ~52 тыс. параметров).
-- Раз миграция ещё никуда не выпущена, дешевле не заводить их вовсе, чем потом снимать
-- через DROP TYPE с перекастом колонки на всей таблице.
ALTER TYPE "public"."property_type" ADD VALUE 'integer';--> statement-breakpoint
CREATE TABLE "component_style_reference_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "component_style_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"invariant_property_value_id" uuid,
	"variation_property_value_id" uuid,
	"style_combination_id" uuid,
	"target_appearance_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "csr_exactly_one_source" CHECK ((
        ("component_style_references"."invariant_property_value_id" is not null)::int +
        ("component_style_references"."variation_property_value_id" is not null)::int +
        ("component_style_references"."style_combination_id" is not null)::int
      ) = 1)
);--> statement-breakpoint
CREATE TABLE "state_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_ids" uuid[] NOT NULL,
	"owner_component_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_no_state_unique";--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_state_unique";--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_no_state_unique";--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_state_unique";--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "state_set_id" uuid;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "combination_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "state_set_id" uuid;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "state_set_id" uuid;--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_reference_id_component_style_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."component_style_references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_invariant_property_value_id_invariant_property_values_id_fk" FOREIGN KEY ("invariant_property_value_id") REFERENCES "public"."invariant_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_variation_property_value_id_variation_property_values_id_fk" FOREIGN KEY ("variation_property_value_id") REFERENCES "public"."variation_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_style_combination_id_style_combinations_id_fk" FOREIGN KEY ("style_combination_id") REFERENCES "public"."style_combinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_target_appearance_id_appearances_id_fk" FOREIGN KEY ("target_appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_sets" ADD CONSTRAINT "state_sets_owner_component_id_components_id_fk" FOREIGN KEY ("owner_component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "states" ADD CONSTRAINT "states_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csrs_reference_id_style_id_unique" ON "component_style_reference_styles" USING btree ("reference_id","style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "csr_invariant_value_unique" ON "component_style_references" USING btree ("invariant_property_value_id") WHERE invariant_property_value_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "csr_variation_value_unique" ON "component_style_references" USING btree ("variation_property_value_id") WHERE variation_property_value_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "csr_style_combination_unique" ON "component_style_references" USING btree ("style_combination_id") WHERE style_combination_id is not null;--> statement-breakpoint
CREATE INDEX "csr_target_appearance_idx" ON "component_style_references" USING btree ("target_appearance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "state_sets_state_ids_unique" ON "state_sets" USING btree ("state_ids");--> statement-breakpoint
CREATE INDEX "state_sets_state_ids_gin" ON "state_sets" USING gin ("state_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "states_component_id_name_unique" ON "states" USING btree ("component_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "states_name_unique_global" ON "states" USING btree ("name") WHERE "states"."component_id" is null;--> statement-breakpoint
-- Заполняем ключ для уже существующих строк. Идентичность сочетания задаётся набором
-- стилей-участников, а они лежат в style_combination_members, поэтому ключ собирается
-- из связанной таблицы: отсортированные идентификаторы через запятую.
-- Без этого шага все прежние строки получают пустой ключ, уникальность фактически
-- проверяется по паре (property_id, appearance_id), и создание индекса падает: у одной
-- такой пары бывают десятки сочетаний.
UPDATE "style_combinations" sc
SET "combination_key" = coalesce((
  SELECT string_agg(m."style_id"::text, ',' ORDER BY m."style_id"::text)
  FROM "style_combination_members" m
  WHERE m."combination_id" = sc."id"
), '');
--> statement-breakpoint
-- Отсутствие индекса до сих пор допускало настоящие дубликаты. Если они есть, индекс
-- всё равно не создастся, но констрейнт сообщит об этом невнятно. Останавливаемся раньше
-- и называем причину.
--
-- Проверка стоит здесь, до разворачивания jsonb: после него строки, отличающиеся только
-- набором состояний, разделят тройку (property_id, appearance_id, combination_key)
-- законно, и та же проверка дала бы ложное срабатывание.
DO $$
DECLARE duplicated integer;
BEGIN
  SELECT count(*) INTO duplicated FROM (
    SELECT 1 FROM "style_combinations"
    GROUP BY "property_id", "appearance_id", "combination_key"
    HAVING count(*) > 1
  ) t;

  IF duplicated > 0 THEN
    RAISE EXCEPTION 'style_combinations contains % duplicated (property_id, appearance_id, combination_key) groups', duplicated
      USING HINT = 'Deduplicate style_combinations before applying this migration: rows sharing a property, an appearance and the same set of member styles are the same combination.';
  END IF;
END $$;
--> statement-breakpoint
-- Словарь состояний взаимодействия. Идентификаторы детерминированы, чтобы код мог
-- ссылаться на них без обращения к справочнику, а сиды — не зависеть от порядка вставки.
INSERT INTO "states" ("id", "component_id", "name", "description") VALUES
  ('00000000-0000-4000-8000-000000000001', NULL, 'pressed',   'Нажат'),
  ('00000000-0000-4000-8000-000000000002', NULL, 'hovered',   'Курсор над элементом'),
  ('00000000-0000-4000-8000-000000000003', NULL, 'focused',   'В фокусе'),
  ('00000000-0000-4000-8000-000000000004', NULL, 'selected',  'Выбран'),
  ('00000000-0000-4000-8000-000000000005', NULL, 'activated', 'Активирован'),
  ('00000000-0000-4000-8000-000000000006', NULL, 'readonly',  'Только для чтения'),
  ('00000000-0000-4000-8000-000000000007', NULL, 'disabled',  'Недоступен');
--> statement-breakpoint
-- Пустой набор — строка-сентинел, а не NULL: NULL-ы в btree различны, и уникальность
-- значений перестала бы работать именно для базовых значений, то есть для большинства.
INSERT INTO "state_sets" ("id", "state_ids", "owner_component_id")
VALUES ('00000000-0000-4000-8000-0000000000ff', '{}', NULL);
--> statement-breakpoint
-- Прежде значение несло одно состояние в колонке. Набор из одного элемента заводится
-- на каждое состояние, реально встречающееся в данных. Компонентных состояний тут быть
-- не может: их источник — заливка uikit-api-meta, а не миграция, поэтому все построенные
-- здесь наборы ничьи и owner_component_id у них остаётся NULL.
INSERT INTO "state_sets" ("state_ids")
SELECT ARRAY[s."id"]
  FROM "states" s
 WHERE s."component_id" IS NULL
   AND s."name" IN (
     SELECT DISTINCT "state"::text FROM "variation_property_values" WHERE "state" IS NOT NULL
     UNION
     SELECT DISTINCT "state"::text FROM "invariant_property_values"  WHERE "state" IS NOT NULL
   );
--> statement-breakpoint
UPDATE "variation_property_values" v
SET "state_set_id" = CASE
  WHEN v."state" IS NULL THEN '00000000-0000-4000-8000-0000000000ff'::uuid
  ELSE (
    SELECT ss."id" FROM "state_sets" ss
      JOIN "states" s ON s."id" = ss."state_ids"[1]
     WHERE array_length(ss."state_ids", 1) = 1
       AND s."component_id" IS NULL
       AND s."name" = v."state"::text
  )
END;
--> statement-breakpoint
UPDATE "invariant_property_values" v
SET "state_set_id" = CASE
  WHEN v."state" IS NULL THEN '00000000-0000-4000-8000-0000000000ff'::uuid
  ELSE (
    SELECT ss."id" FROM "state_sets" ss
      JOIN "states" s ON s."id" = ss."state_ids"[1]
     WHERE array_length(ss."state_ids", 1) = 1
       AND s."component_id" IS NULL
       AND s."name" = v."state"::text
  )
END;
--> statement-breakpoint
UPDATE "style_combinations" SET "state_set_id" = '00000000-0000-4000-8000-0000000000ff'::uuid;
--> statement-breakpoint
-- Разворачиваем style_combinations.states: прежде строка несла базовое значение плюс
-- массив переопределений в jsonb вида [{"state":["activated"],"value":32}]. Это было
-- четвёртое представление состояний — вне словаря и вне ссылочной целостности.
--
-- Каждое переопределение становится отдельной строкой со своим набором. Участники
-- копируются: идентичность сочетания задаётся ими, и без копии новая строка перестала
-- бы быть тем же сочетанием.
--
-- Неизвестное имя состояния останавливает миграцию. Молча отбросить переопределение
-- нельзя: оно и есть те данные, ради которых разворачивание затевается.
DO $$
DECLARE
  r record;
  ids uuid[];
  set_id uuid;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT sc."id", sc."property_id", sc."appearance_id", sc."combination_key", e."elem"
      FROM "style_combinations" sc,
           LATERAL jsonb_array_elements(sc."states") e("elem")
     WHERE sc."states" IS NOT NULL
       AND jsonb_typeof(sc."states") = 'array'
  LOOP
    IF jsonb_typeof(r."elem"->'state') <> 'array' THEN
      RAISE EXCEPTION 'style_combinations %: expected an array in states[].state, got %',
        r."id", jsonb_typeof(r."elem"->'state');
    END IF;

    -- Сортировка обязательна: уникальность uuid[] в PostgreSQL позиционная, а триггер
    -- канонизации на этом шаге ещё не создан — он появляется ниже, после переноса данных.
    SELECT array_agg(DISTINCT s."id" ORDER BY s."id") INTO ids
      FROM jsonb_array_elements_text(r."elem"->'state') n("name")
      JOIN "states" s ON s."name" = n."name" AND s."component_id" IS NULL;

    IF ids IS NULL OR array_length(ids, 1) <> (
      SELECT count(DISTINCT n."name") FROM jsonb_array_elements_text(r."elem"->'state') n("name")
    ) THEN
      RAISE EXCEPTION 'style_combinations %: unknown state name in %', r."id", r."elem"->'state'
        USING HINT = 'Only interaction states exist at migration time; component states are created by the uikit-api-meta import.';
    END IF;

    SELECT ss."id" INTO set_id FROM "state_sets" ss WHERE ss."state_ids" = ids;
    IF set_id IS NULL THEN
      INSERT INTO "state_sets" ("state_ids") VALUES (ids) RETURNING "id" INTO set_id;
    END IF;

    INSERT INTO "style_combinations"
      ("property_id", "appearance_id", "combination_key", "value", "state_set_id")
    VALUES
      (r."property_id", r."appearance_id", r."combination_key", r."elem"->>'value', set_id)
    RETURNING "id" INTO new_id;

    INSERT INTO "style_combination_members" ("combination_id", "style_id")
    SELECT new_id, m."style_id"
      FROM "style_combination_members" m
     WHERE m."combination_id" = r."id";
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ALTER COLUMN "state_set_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ALTER COLUMN "state_set_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "style_combinations" ALTER COLUMN "state_set_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_state_set_id_state_sets_id_fk" FOREIGN KEY ("state_set_id") REFERENCES "public"."state_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD CONSTRAINT "style_combinations_state_set_id_state_sets_id_fk" FOREIGN KEY ("state_set_id") REFERENCES "public"."state_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_state_set_id_state_sets_id_fk" FOREIGN KEY ("state_set_id") REFERENCES "public"."state_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ipv_ds_comp_prop_app_states_unique" ON "invariant_property_values" USING btree ("design_system_id","component_id","property_id","appearance_id","state_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sc_property_appearance_combination_unique" ON "style_combinations" USING btree ("property_id","appearance_id","combination_key","state_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vpv_style_property_appearance_states_unique" ON "variation_property_values" USING btree ("style_id","property_id","appearance_id","state_set_id");--> statement-breakpoint
ALTER TABLE "variation_property_values" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "invariant_property_values" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "style_combinations" DROP COLUMN "states";
--> statement-breakpoint
DROP TYPE "public"."state";
--> statement-breakpoint
-- Целостность массива state_ids.
--
-- Внешние ключи внутрь массива в PostgreSQL невыразимы, поэтому то, что в схеме с таблицей
-- участников давал бы FK, здесь держат триггеры. Отсутствие любого из них — дефект, а не
-- оптимизация: висячий идентификатор в массиве не обнаруживается ничем.
--
-- Здесь же вычисляется owner_component_id. Он производен от состава, поэтому не принимается
-- от клиента: принятое снаружи значение вернуло бы в схему второй источник истины — ровно то,
-- ради устранения чего затевалось изменение.
CREATE OR REPLACE FUNCTION "state_sets_canonicalize"() RETURNS trigger AS $$
DECLARE
  canonical uuid[];
  known integer;
  owners integer;
  owner_id uuid;
BEGIN
  SELECT array_agg(DISTINCT x ORDER BY x) INTO canonical
    FROM unnest(NEW."state_ids") x;
  NEW."state_ids" := coalesce(canonical, '{}'::uuid[]);

  IF array_length(NEW."state_ids", 1) IS NOT NULL THEN
    SELECT count(*) INTO known FROM "states" s WHERE s."id" = ANY(NEW."state_ids");
    IF known <> array_length(NEW."state_ids", 1) THEN
      RAISE EXCEPTION 'state_sets.state_ids references a state that does not exist'
        USING HINT = 'Resolve state identifiers through POST /ds/state-sets/resolve instead of writing state_sets directly.';
    END IF;

    -- Состояния разных компонентов в одном наборе — набор, который не может наступить
    -- ни у одного из них.
    -- Агрегат по массиву, а не min(): у uuid в PostgreSQL нет min/max.
    SELECT count(DISTINCT s."component_id"), (array_agg(DISTINCT s."component_id"))[1]
      INTO owners, owner_id
      FROM "states" s
     WHERE s."id" = ANY(NEW."state_ids") AND s."component_id" IS NOT NULL;

    IF owners > 1 THEN
      RAISE EXCEPTION 'state_sets.state_ids mixes component states of % different components', owners
        USING HINT = 'A state set may hold component states of at most one component.';
    END IF;

    NEW."owner_component_id" := owner_id;
  ELSE
    NEW."owner_component_id" := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "state_sets_canonicalize"
BEFORE INSERT OR UPDATE ON "state_sets"
FOR EACH ROW EXECUTE FUNCTION "state_sets_canonicalize"();
--> statement-breakpoint
-- Удаление состояния удаляет наборы, которые его содержат, а дальше каскад по state_set_id
-- удаляет значения. Набор не сжимается: сжатие означало бы перезапись базового значения
-- переопределением, потому что переопределение на {hovered} существует ровно там, где есть
-- базовое значение.
CREATE OR REPLACE FUNCTION "states_delete_dependent_sets"() RETURNS trigger AS $$
BEGIN
  DELETE FROM "state_sets" WHERE "state_ids" @> ARRAY[OLD."id"];
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "states_delete_dependent_sets"
AFTER DELETE ON "states"
FOR EACH ROW EXECUTE FUNCTION "states_delete_dependent_sets"();
--> statement-breakpoint
-- Строчные триггеры на TRUNCATE не срабатывают, поэтому без запрета на уровне оператора
-- TRUNCATE states CASCADE вычистил бы словарь и оставил висячие идентификаторы в массивах.
CREATE OR REPLACE FUNCTION "states_reject_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE on % is not allowed', TG_TABLE_NAME
    USING HINT = 'Row-level triggers do not fire on TRUNCATE, so it would leave dangling state identifiers in state_sets.state_ids. Delete rows instead.';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "states_reject_truncate"
BEFORE TRUNCATE ON "states"
FOR EACH STATEMENT EXECUTE FUNCTION "states_reject_truncate"();
--> statement-breakpoint
CREATE TRIGGER "state_sets_reject_truncate"
BEFORE TRUNCATE ON "state_sets"
FOR EACH STATEMENT EXECUTE FUNCTION "states_reject_truncate"();
--> statement-breakpoint
-- Сентинел — разделяемая строка с наибольшим радиусом поражения в схеме: на неё ссылается
-- всякое базовое значение. Под каскадом по state_set_id одна команда DELETE снесла бы их все,
-- а триггер удаления зависимых наборов её не прикрывает: пустой массив не содержит состояний.
CREATE OR REPLACE FUNCTION "state_sets_guard_sentinel"() RETURNS trigger AS $$
BEGIN
  IF OLD."state_ids" = '{}'::uuid[] THEN
    RAISE EXCEPTION 'the empty state set is a sentinel and cannot be deleted'
      USING HINT = 'Every value that applies outside of any state references this row.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "state_sets_guard_sentinel"
BEFORE DELETE ON "state_sets"
FOR EACH ROW EXECUTE FUNCTION "state_sets_guard_sentinel"();
--> statement-breakpoint
-- Когерентность значения и набора.
--
-- Проверка состава ловит смешанный набор {CheckBox.checked, Switch.checked}, но не чужой
-- {Switch.checked} на значении CheckBox: внутренне такой набор безупречен. Между тем именно
-- чужой рождается из разрешения имени состояния без фильтра по компоненту — тот же механизм,
-- что дал расхождение на дубле Checkbox/CheckBox.
CREATE OR REPLACE FUNCTION "value_state_set_coherent"() RETURNS trigger AS $$
DECLARE
  owner_id uuid;
  value_component uuid;
BEGIN
  SELECT ss."owner_component_id" INTO owner_id
    FROM "state_sets" ss WHERE ss."id" = NEW."state_set_id";

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'invariant_property_values' THEN
    value_component := NEW."component_id";
  ELSE
    SELECT vr."component_id" INTO value_component
      FROM "styles" st
      JOIN "variations" vr ON vr."id" = st."variation_id"
     WHERE st."id" = NEW."style_id";
  END IF;

  IF value_component IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION '% references a state set owned by another component', TG_TABLE_NAME
      USING HINT = 'A value may reference either an ownerless set or a set owned by its own component.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "vpv_state_set_coherent"
BEFORE INSERT OR UPDATE ON "variation_property_values"
FOR EACH ROW EXECUTE FUNCTION "value_state_set_coherent"();
--> statement-breakpoint
CREATE TRIGGER "ipv_state_set_coherent"
BEFORE INSERT OR UPDATE ON "invariant_property_values"
FOR EACH ROW EXECUTE FUNCTION "value_state_set_coherent"();
--> statement-breakpoint
-- У сочетания компонент определяется только через участников, а они пишутся после самой
-- строки сочетания — по той же причине, по какой combination_key заполняется отдельным шагом.
-- Поэтому проверка висит на участниках, а не на style_combinations.
CREATE OR REPLACE FUNCTION "combination_member_state_set_coherent"() RETURNS trigger AS $$
DECLARE
  owner_id uuid;
  member_component uuid;
BEGIN
  SELECT ss."owner_component_id" INTO owner_id
    FROM "style_combinations" sc
    JOIN "state_sets" ss ON ss."id" = sc."state_set_id"
   WHERE sc."id" = NEW."combination_id";

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT vr."component_id" INTO member_component
    FROM "styles" st
    JOIN "variations" vr ON vr."id" = st."variation_id"
   WHERE st."id" = NEW."style_id";

  IF member_component IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION 'style_combination_members: member style belongs to a component other than the combination state set owner'
      USING HINT = 'Members of a combination must all belong to the component owning its state set.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "scm_state_set_coherent"
BEFORE INSERT OR UPDATE ON "style_combination_members"
FOR EACH ROW EXECUTE FUNCTION "combination_member_state_set_coherent"();
--> statement-breakpoint
CREATE TABLE "appearance_variation_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appearance_variation_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"authored_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appearance_variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appearance_id" uuid NOT NULL,
	"variation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"default_style_id" uuid,
	"is_color_scheme" boolean DEFAULT false NOT NULL,
	"declared_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appearance_combination_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appearance_combination_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appearance_combinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appearance_id" uuid NOT NULL,
	"combination_key" text NOT NULL,
	"position" integer NOT NULL,
	"authored_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "styles_variation_id_ds_id_is_default_unique";--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "alpha" text;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "adjustment" text;--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "token_id" uuid;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "alpha" text;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "adjustment" text;--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "alpha" text;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "adjustment" text;--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "appearance_variation_values" ADD CONSTRAINT "appearance_variation_values_appearance_variation_id_appearance_variations_id_fk" FOREIGN KEY ("appearance_variation_id") REFERENCES "public"."appearance_variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_variation_values" ADD CONSTRAINT "appearance_variation_values_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_variations" ADD CONSTRAINT "appearance_variations_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_variations" ADD CONSTRAINT "appearance_variations_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_variations" ADD CONSTRAINT "appearance_variations_default_style_id_styles_id_fk" FOREIGN KEY ("default_style_id") REFERENCES "public"."styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_combination_members" ADD CONSTRAINT "appearance_combination_members_appearance_combination_id_appearance_combinations_id_fk" FOREIGN KEY ("appearance_combination_id") REFERENCES "public"."appearance_combinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_combination_members" ADD CONSTRAINT "appearance_combination_members_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appearance_combinations" ADD CONSTRAINT "appearance_combinations_appearance_id_appearances_id_fk" FOREIGN KEY ("appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avv_variation_style_unique" ON "appearance_variation_values" USING btree ("appearance_variation_id","style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "avv_variation_position_unique" ON "appearance_variation_values" USING btree ("appearance_variation_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "av_appearance_variation_unique" ON "appearance_variations" USING btree ("appearance_id","variation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "av_appearance_position_unique" ON "appearance_variations" USING btree ("appearance_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "acm_combination_style_unique" ON "appearance_combination_members" USING btree ("appearance_combination_id","style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acm_combination_position_unique" ON "appearance_combination_members" USING btree ("appearance_combination_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "ac_appearance_key_unique" ON "appearance_combinations" USING btree ("appearance_id","combination_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ac_appearance_position_unique" ON "appearance_combinations" USING btree ("appearance_id","position");--> statement-breakpoint
ALTER TABLE "style_combinations" ADD CONSTRAINT "style_combinations_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- ─── Перенос данных: объявления осей ────────────────────────────────────────────
--
-- Объявление осей вариаций переезжает на уровень appearance. Из существующих данных
-- восстанавливается только состав осей и их значения; два факта восстановить нечем,
-- и миграция не притворяется, что их знает:
--
--   * порядок осей и порядок значений внутри оси нигде не хранился — здесь он
--     детерминирован по имени, а настоящий приходит с `components push`;
--   * дефолт оси хранился флагом `styles.is_default`, уникальным по (ДС, ось), тогда как
--     принадлежит паре (appearance, ось). Перенос копирует единственный уцелевший флаг
--     на все appearance компонента — иного источника у него нет.
--
--     Насколько это верно, зависит от того, кто заполнял флаг.
--
--     Если дизайн-систему вёл клиент, перенос точен: уникальный индекс по (ДС, ось)
--     не позволял задать два разных дефолта, поэтому размножать нечего — второго
--     значения никогда и не существовало.
--
--     Если по базе гоняли `components push`, перенос ошибается. Прежний `applyDefaults`
--     снимал флаг со всей оси и ставил заново на каждой конфигурации пакета, так что
--     в базе оседал последний записавший. На `sdds_serv` спорят о дефолте 7 осей из 133,
--     и перенос ставит неверно 11 дефолтов из 260 — 4.2%. Такие базы стоит перезалить:
--     новый импорт пишет дефолт по-appearance и восстанавливает все значения.
--
-- Ось считается принадлежащей appearance, если её стиль участвует в значениях этого
-- appearance: напрямую через `variation_property_values` или как участник кросс-осевого
-- сочетания. Выводить ось из наличия стилей в дизайн-системе нельзя — так появляются
-- фантомные оси у appearance, который ось не использует.
INSERT INTO "appearance_variations" ("appearance_id", "variation_id", "position", "default_style_id")
SELECT
  used."appearance_id",
  used."variation_id",
  (row_number() OVER (PARTITION BY used."appearance_id" ORDER BY used."variation_name") - 1)::integer,
  (
    SELECT s."id"
    FROM "styles" s
    WHERE s."variation_id" = used."variation_id"
      AND s."design_system_id" = used."design_system_id"
      AND s."is_default" = true
    LIMIT 1
  )
FROM (
  SELECT DISTINCT
    a."id"                AS "appearance_id",
    a."design_system_id"  AS "design_system_id",
    v."id"                AS "variation_id",
    v."name"              AS "variation_name"
  FROM "appearances" a
  JOIN "styles" s ON s."design_system_id" = a."design_system_id"
  JOIN "variations" v ON v."id" = s."variation_id" AND v."component_id" = a."component_id"
  WHERE EXISTS (
      SELECT 1 FROM "variation_property_values" vpv
      WHERE vpv."appearance_id" = a."id" AND vpv."style_id" = s."id"
    )
     OR EXISTS (
      SELECT 1
      FROM "style_combination_members" scm
      JOIN "style_combinations" sc ON sc."id" = scm."combination_id"
      WHERE sc."appearance_id" = a."id" AND scm."style_id" = s."id"
    )
) used
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "appearance_variation_values" ("appearance_variation_id", "style_id", "position")
SELECT
  av."id",
  s."id",
  (row_number() OVER (PARTITION BY av."id" ORDER BY s."name") - 1)::integer
FROM "appearance_variations" av
JOIN "appearances" a ON a."id" = av."appearance_id"
JOIN "styles" s ON s."variation_id" = av."variation_id" AND s."design_system_id" = a."design_system_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ─── Перенос данных: роль оси цветовой схемы ────────────────────────────────────
--
-- Роль объявляет конфигурация, и в общем виде из базы её не восстановить. Достоверно
-- известен один случай: ось с именем `view`. Прежняя выгрузка опознавала ось схемы ровно
-- по этому имени, поэтому для неё перенос ничего не меняет и ничего не портит.
--
-- Оси схемы под другими именами остаются без роли до повторной заливки пакета: в корпусе
-- `sdds_sbcom` таких имён пять — `mode-color`, `mode`, `mute`, `state`, `variant`.
--
-- Фантомные значения осей, заведённые прежним импортом из ключей записей `view`, здесь
-- НЕ удаляются. Опознать их нечем: в модели они лежат такими же строками
-- `appearance_variation_values`, что и настоящие значения, а исходного пакета у миграции
-- нет. Пример: у оси `state` компонента `Indicator` десять значений вместо пяти —
-- настоящие `accent`…`warning` и фантомные `state-accent`…`state-warning`.
-- Приводится в порядок повторным `components push`.
UPDATE "appearance_variations" av
SET "is_color_scheme" = true
FROM "variations" v
WHERE v."id" = av."variation_id" AND v."name" = 'view';--> statement-breakpoint

-- ─── Перенос данных: объявления сочетаний ───────────────────────────────────────
--
-- Координаты, уже существующие в модели, объявляются задним числом: до этой миграции
-- сочетание существовало только как строка значения, поэтому восстановить можно ровно те,
-- по которым что-то переопределено. Координата без единого свойства следа не оставила
-- и восстановлению не подлежит — она появится при следующей заливке пакета.
INSERT INTO "appearance_combinations" ("appearance_id", "combination_key", "position")
SELECT
  sc."appearance_id",
  sc."combination_key",
  (row_number() OVER (PARTITION BY sc."appearance_id" ORDER BY sc."combination_key") - 1)::integer
FROM (
  SELECT DISTINCT "appearance_id", "combination_key"
  FROM "style_combinations"
  WHERE "combination_key" <> ''
) sc
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "appearance_combination_members" ("appearance_combination_id", "style_id", "position")
SELECT
  ac."id",
  m."style_id",
  (row_number() OVER (PARTITION BY ac."id" ORDER BY m."style_id") - 1)::integer
FROM "appearance_combinations" ac
JOIN "style_combinations" sc
  ON sc."appearance_id" = ac."appearance_id" AND sc."combination_key" = ac."combination_key"
JOIN (
  SELECT DISTINCT "combination_id", "style_id" FROM "style_combination_members"
) m ON m."combination_id" = sc."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ─── Перенос данных: ссылка на токен у кросс-осевых значений ────────────────────
--
-- Прежде имя токена лежало в `value` текстом, поэтому переименование токена оставляло
-- в сочетании имя несуществующего.
--
-- Сопоставление только для свойств, чей тип вообще ссылается на токен: литерал
-- `component_style` или `icon`, случайно совпавший с именем токена, получил бы ссылку
-- и вместе с ней ложный вид заливки. Несопоставленные остаются NULL — это битые ссылки
-- в самих конфигурациях, и выгрузка предъявляет их отдельным списком.
UPDATE "style_combinations" sc
SET "token_id" = t."id"
FROM "appearances" a, "properties" p, "tokens" t
WHERE a."id" = sc."appearance_id"
  AND p."id" = sc."property_id"
  AND p."type" IN ('color', 'typography', 'shape', 'shadow')
  AND t."design_system_id" = a."design_system_id"
  AND t."name" = sc."value";--> statement-breakpoint

-- Снимается последним: перенос дефолтов выше читает этот флаг.
ALTER TABLE "styles" DROP COLUMN "is_default";


-- Source: 0005_component_platform.sql
CREATE TYPE "public"."component_platform" AS ENUM('web', 'compose', 'ios');--> statement-breakpoint
DROP INDEX "appearances_design_system_id_component_id_name_unique";--> statement-breakpoint
ALTER TABLE "appearances" ADD COLUMN "platform" "component_platform";--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "platform" "component_platform";--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_ds_component_name_platform_unique" UNIQUE NULLS NOT DISTINCT("design_system_id","component_id","name","platform");

-- Source: 0006_military_mephisto.sql
DROP INDEX "tenants_design_system_id_name_unique";--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "edit_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "tenants"
SET "name" = regexp_replace(btrim("name"), '\s+', ' ', 'g')
WHERE "name" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_design_system_id_name_ci_unique" ON "tenants" USING btree ("design_system_id",lower("name"));
