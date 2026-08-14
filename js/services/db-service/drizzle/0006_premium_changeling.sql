CREATE TABLE "component_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_value_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variation_property_value_id" uuid,
	"invariant_property_value_id" uuid,
	"state" "state",
	"component_state_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvs_exactly_one_value" CHECK ((
        ("property_value_states"."variation_property_value_id" is not null)::int +
        ("property_value_states"."invariant_property_value_id" is not null)::int
      ) = 1),
	CONSTRAINT "pvs_exactly_one_state" CHECK ((
        ("property_value_states"."state" is not null)::int +
        ("property_value_states"."component_state_id" is not null)::int
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "component_states" ADD CONSTRAINT "component_states_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "property_value_states" ADD CONSTRAINT "property_value_states_variation_property_value_id_variation_property_values_id_fk" FOREIGN KEY ("variation_property_value_id") REFERENCES "public"."variation_property_values"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "property_value_states" ADD CONSTRAINT "property_value_states_invariant_property_value_id_invariant_property_values_id_fk" FOREIGN KEY ("invariant_property_value_id") REFERENCES "public"."invariant_property_values"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "cs_component_id_name_unique" ON "component_states" USING btree ("component_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "pvs_variation_value_state_unique" ON "property_value_states" USING btree ("variation_property_value_id","state") WHERE variation_property_value_id is not null and state is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "pvs_variation_value_component_state_unique" ON "property_value_states" USING btree ("variation_property_value_id","component_state_id") WHERE variation_property_value_id is not null and component_state_id is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "pvs_invariant_value_state_unique" ON "property_value_states" USING btree ("invariant_property_value_id","state") WHERE invariant_property_value_id is not null and state is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "pvs_invariant_value_component_state_unique" ON "property_value_states" USING btree ("invariant_property_value_id","component_state_id") WHERE invariant_property_value_id is not null and component_state_id is not null;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "component_state_id" uuid;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD COLUMN "states_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "component_state_id" uuid;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "states_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "property_value_states" ADD CONSTRAINT "property_value_states_component_state_id_component_states_id_fk" FOREIGN KEY ("component_state_id") REFERENCES "public"."component_states"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ADD CONSTRAINT "invariant_property_values_component_state_id_component_states_id_fk" FOREIGN KEY ("component_state_id") REFERENCES "public"."component_states"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD CONSTRAINT "variation_property_values_component_state_id_component_states_id_fk" FOREIGN KEY ("component_state_id") REFERENCES "public"."component_states"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_no_state_unique";
--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_state_unique";
--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_no_state_unique";
--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_state_unique";
--> statement-breakpoint
-- Переносим состояния в новую модель до сужения enum и до создания уникальных индексов.
--
-- Прежняя колонка вмещала одно состояние: набор `["checked","focused"]` разворачивался
-- в отдельные строки, и конъюнкция терялась. Здесь каждая существующая строка получает
-- ключ из своего единственного состояния и одну запись связи.
--
-- Состояния, специфичные для компонента, при этом отделяются от состояний взаимодействия
-- и заводятся в component_states.
INSERT INTO "component_states" ("component_id", "name")
SELECT DISTINCT p."component_id", vpv."state"::text
FROM "variation_property_values" vpv
JOIN "properties" p ON p."id" = vpv."property_id"
WHERE vpv."state" IS NOT NULL AND vpv."state"::text NOT IN ('pressed','hovered','focused','selected','activated','readonly','disabled') AND p."component_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "component_states" ("component_id", "name")
SELECT DISTINCT ipv."component_id", ipv."state"::text
FROM "invariant_property_values" ipv
WHERE ipv."state" IS NOT NULL AND ipv."state"::text NOT IN ('pressed','hovered','focused','selected','activated','readonly','disabled')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "variation_property_values" SET "states_key" = coalesce("state"::text, '');
--> statement-breakpoint
UPDATE "invariant_property_values" SET "states_key" = coalesce("state"::text, '');
--> statement-breakpoint
INSERT INTO "property_value_states" ("variation_property_value_id", "state")
SELECT vpv."id", vpv."state" FROM "variation_property_values" vpv
WHERE vpv."state" IS NOT NULL AND vpv."state"::text IN ('pressed','hovered','focused','selected','activated','readonly','disabled');
--> statement-breakpoint
INSERT INTO "property_value_states" ("variation_property_value_id", "component_state_id")
SELECT vpv."id", cs."id" FROM "variation_property_values" vpv
JOIN "properties" p ON p."id" = vpv."property_id"
JOIN "component_states" cs ON cs."component_id" = p."component_id" AND cs."name" = vpv."state"::text
WHERE vpv."state" IS NOT NULL AND vpv."state"::text NOT IN ('pressed','hovered','focused','selected','activated','readonly','disabled');
--> statement-breakpoint
INSERT INTO "property_value_states" ("invariant_property_value_id", "state")
SELECT ipv."id", ipv."state" FROM "invariant_property_values" ipv
WHERE ipv."state" IS NOT NULL AND ipv."state"::text IN ('pressed','hovered','focused','selected','activated','readonly','disabled');
--> statement-breakpoint
INSERT INTO "property_value_states" ("invariant_property_value_id", "component_state_id")
SELECT ipv."id", cs."id" FROM "invariant_property_values" ipv
JOIN "component_states" cs ON cs."component_id" = ipv."component_id" AND cs."name" = ipv."state"::text
WHERE ipv."state" IS NOT NULL AND ipv."state"::text NOT IN ('pressed','hovered','focused','selected','activated','readonly','disabled');
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ALTER COLUMN "state" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "property_value_states" ALTER COLUMN "state" SET DATA TYPE text;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ALTER COLUMN "state" SET DATA TYPE text;
--> statement-breakpoint
DROP TYPE "public"."state";
--> statement-breakpoint
CREATE TYPE "public"."state" AS ENUM('pressed', 'hovered', 'focused', 'selected', 'activated', 'readonly', 'disabled');
--> statement-breakpoint
ALTER TABLE "invariant_property_values" ALTER COLUMN "state" SET DATA TYPE "public"."state" USING "state"::"public"."state";
--> statement-breakpoint
ALTER TABLE "property_value_states" ALTER COLUMN "state" SET DATA TYPE "public"."state" USING "state"::"public"."state";
--> statement-breakpoint
ALTER TABLE "variation_property_values" ALTER COLUMN "state" SET DATA TYPE "public"."state" USING "state"::"public"."state";
--> statement-breakpoint
CREATE UNIQUE INDEX "ipv_ds_comp_prop_app_states_unique" ON "invariant_property_values" USING btree ("design_system_id","component_id","property_id","appearance_id","states_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "vpv_style_property_appearance_states_unique" ON "variation_property_values" USING btree ("style_id","property_id","appearance_id","states_key");
--> statement-breakpoint
ALTER TABLE "invariant_property_values" DROP CONSTRAINT "invariant_property_values_component_state_id_component_states_id_fk";
--> statement-breakpoint
ALTER TABLE "variation_property_values" DROP CONSTRAINT "variation_property_values_component_state_id_component_states_id_fk";
--> statement-breakpoint
ALTER TABLE "invariant_property_values" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "invariant_property_values" DROP COLUMN "component_state_id";
--> statement-breakpoint
ALTER TABLE "variation_property_values" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "variation_property_values" DROP COLUMN "component_state_id";
