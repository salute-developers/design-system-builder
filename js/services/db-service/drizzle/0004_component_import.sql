ALTER TYPE "public"."property_type" ADD VALUE 'component_style';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'value';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'icon';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'boolean';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'gradient';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'blur';
--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'integer';
--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'activated';
--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "combination_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
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
CREATE UNIQUE INDEX "sc_property_appearance_combination_unique" ON "style_combinations" USING btree ("property_id","appearance_id","combination_key");
--> statement-breakpoint
CREATE TABLE "component_style_reference_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_reference_id_component_style_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."component_style_references"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_invariant_property_value_id_invariant_property_values_id_fk" FOREIGN KEY ("invariant_property_value_id") REFERENCES "public"."invariant_property_values"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_variation_property_value_id_variation_property_values_id_fk" FOREIGN KEY ("variation_property_value_id") REFERENCES "public"."variation_property_values"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_style_combination_id_style_combinations_id_fk" FOREIGN KEY ("style_combination_id") REFERENCES "public"."style_combinations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_target_appearance_id_appearances_id_fk" FOREIGN KEY ("target_appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "csrs_reference_id_style_id_unique" ON "component_style_reference_styles" USING btree ("reference_id","style_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "csr_invariant_value_unique" ON "component_style_references" USING btree ("invariant_property_value_id") WHERE invariant_property_value_id is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "csr_variation_value_unique" ON "component_style_references" USING btree ("variation_property_value_id") WHERE variation_property_value_id is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "csr_style_combination_unique" ON "component_style_references" USING btree ("style_combination_id") WHERE style_combination_id is not null;
--> statement-breakpoint
CREATE INDEX "csr_target_appearance_idx" ON "component_style_references" USING btree ("target_appearance_id");
--> statement-breakpoint
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
ALTER TABLE "invariant_property_values" ADD COLUMN "states_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "variation_property_values" ADD COLUMN "states_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "property_value_states" ADD CONSTRAINT "property_value_states_component_state_id_component_states_id_fk" FOREIGN KEY ("component_state_id") REFERENCES "public"."component_states"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_no_state_unique";
--> statement-breakpoint
DROP INDEX "ipv_ds_comp_prop_app_state_unique";
--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_no_state_unique";
--> statement-breakpoint
DROP INDEX "vpv_style_property_appearance_state_unique";
--> statement-breakpoint
-- Переносим состояния в новую модель.
--
-- Прежде значение несло одно состояние в колонке. Теперь оно несёт набор: связи лежат
-- в property_value_states, а в таблице значений остаётся канонический ключ набора.
-- У существующих строк набор состоит ровно из одного состояния, поэтому ключ равен
-- прежнему значению колонки, а связь создаётся одна.
--
-- Состояний, специфичных для компонента, здесь быть не может: до этой миграции enum
-- их не содержал. Их источник — код компонента, и заводит их заливка uikit-api-meta.
UPDATE "variation_property_values" SET "states_key" = coalesce("state"::text, '');
--> statement-breakpoint
UPDATE "invariant_property_values" SET "states_key" = coalesce("state"::text, '');
--> statement-breakpoint
INSERT INTO "property_value_states" ("variation_property_value_id", "state")
SELECT vpv."id", vpv."state" FROM "variation_property_values" vpv
WHERE vpv."state" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "property_value_states" ("invariant_property_value_id", "state")
SELECT ipv."id", ipv."state" FROM "invariant_property_values" ipv
WHERE ipv."state" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "invariant_property_values" DROP COLUMN "state";
--> statement-breakpoint
ALTER TABLE "variation_property_values" DROP COLUMN "state";
--> statement-breakpoint
CREATE UNIQUE INDEX "ipv_ds_comp_prop_app_states_unique" ON "invariant_property_values" USING btree ("design_system_id","component_id","property_id","appearance_id","states_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "vpv_style_property_appearance_states_unique" ON "variation_property_values" USING btree ("style_id","property_id","appearance_id","states_key");
