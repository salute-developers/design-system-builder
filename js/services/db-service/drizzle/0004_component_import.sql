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
