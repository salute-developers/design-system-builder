-- Flyway-версия миграции drizzle/0007_component_platform_split.sql: baseline V1 заморожен на схеме до разделения платформ,
-- поэтому разделение платформ компонентов применяется поверх него отдельной версией.
-- Журнал изменений без дизайн-системы: глобальные операции (импорт API-меты) пишутся с NULL.
ALTER TABLE "design_system_changes" ALTER COLUMN "design_system_id" DROP NOT NULL;--> statement-breakpoint

-- Разделение платформ компонентов и пометка устаревших алиасов (change
-- split-component-platforms-and-api-deprecated).
--
-- Компонент идентифицируется парой (name, platform). В продуктовых базах есть только веб-компоненты,
-- поэтому все существующие компоненты становятся `web` с теми же идентификаторами, а производный от
-- мет нативный слой удаляется и пересоздаётся `dsbuilder components import-api`:
--   * нативные алиасы (compose, xml, ios) вместе с поправками (каскадом);
--   * нативные свойства (platform IS NULL) и компоненты без веб-признака.
-- Если находится нативный контент дизайн-систем, который нельзя потерять, миграция останавливается.

-- ── 1. Проверки-ограничители ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n integer;
  names text;
BEGIN
  SELECT count(*) INTO n FROM appearances WHERE platform IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Миграция 0007 остановлена: % appearances без платформы (нативные конфиги). Разметьте их вручную или удалите.', n;
  END IF;

  SELECT count(*) INTO n FROM (
    SELECT v.property_id FROM variation_property_values v
    UNION ALL SELECT v.property_id FROM invariant_property_values v
    UNION ALL SELECT v.property_id FROM style_combinations v
  ) AS vals
  JOIN properties p ON p.id = vals.property_id
  WHERE p.platform IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Миграция 0007 остановлена: % значений конфигов лежат на нативных свойствах (platform IS NULL).', n;
  END IF;

  SELECT count(*), string_agg(DISTINCT c.name, ', ') INTO n, names
  FROM design_system_components d
  JOIN components c ON c.id = d.component_id
  WHERE NOT (
    EXISTS (SELECT 1 FROM properties p WHERE p.component_id = c.id AND p.platform = 'web')
    OR EXISTS (SELECT 1 FROM appearances a WHERE a.component_id = c.id AND a.platform = 'web')
    OR EXISTS (SELECT 1 FROM properties p JOIN property_platform_params pp ON pp.property_id = p.id
               WHERE p.component_id = c.id AND pp.platform = 'web')
  )
  AND EXISTS (
    SELECT 1 FROM properties p JOIN property_platform_params pp ON pp.property_id = p.id
    WHERE p.component_id = c.id AND pp.platform <> 'web'
  );
  IF n > 0 THEN
    RAISE EXCEPTION 'Миграция 0007 остановлена: % привязок дизайн-систем к нативным компонентам (%). Удалите привязки или пересоздайте базу.', n, names;
  END IF;
END $$;--> statement-breakpoint

-- Числа до миграции для финальной сверки.
-- Временные таблицы без ON COMMIT DROP: Flyway выполняет baseline вне транзакции (в нём есть ALTER TYPE
-- ... ADD VALUE), и таблица, удаляемая при commit, исчезла бы после первого же оператора.
CREATE TEMP TABLE migration_0007_before AS
SELECT
  (SELECT count(*) FROM appearances) AS appearances,
  (SELECT count(*) FROM variation_property_values) AS variation_values,
  (SELECT count(*) FROM invariant_property_values) AS invariant_values,
  (SELECT count(*) FROM variations) AS variations,
  (SELECT count(*) FROM styles) AS styles,
  (SELECT count(*) FROM design_system_components) AS links;--> statement-breakpoint

-- ── 2. Удаление производного нативного слоя ──────────────────────────────────────────────────
-- Компоненты без веб-признака, у которых есть нативные данные.
CREATE TEMP TABLE migration_0007_native_components AS
SELECT c.id
FROM components c
WHERE NOT (
  EXISTS (SELECT 1 FROM properties p WHERE p.component_id = c.id AND p.platform = 'web')
  OR EXISTS (SELECT 1 FROM appearances a WHERE a.component_id = c.id AND a.platform = 'web')
  OR EXISTS (SELECT 1 FROM properties p JOIN property_platform_params pp ON pp.property_id = p.id
             WHERE p.component_id = c.id AND pp.platform = 'web')
)
AND (
  EXISTS (SELECT 1 FROM properties p WHERE p.component_id = c.id AND p.platform IS NULL)
  OR EXISTS (SELECT 1 FROM properties p JOIN property_platform_params pp ON pp.property_id = p.id
             WHERE p.component_id = c.id AND pp.platform <> 'web')
);--> statement-breakpoint

-- Нативные алиасы; их поправки (variation_/invariant_platform_param_adjustments) уходят каскадом.
DELETE FROM property_platform_params WHERE platform <> 'web';--> statement-breakpoint
-- Нативные свойства (их алиасы уже удалены или уходят каскадом).
DELETE FROM properties WHERE platform IS NULL;--> statement-breakpoint
-- Компоненты без веб-признака: состояния и свойства уходят каскадом.
DELETE FROM components WHERE id IN (SELECT id FROM migration_0007_native_components);--> statement-breakpoint

-- ── 3. Единый словарь платформ ────────────────────────────────────────────────────────────────
-- Новый тип создаётся рядом со старым: добавить значение `xml` в `component_platform` и сразу
-- использовать его в той же транзакции нельзя.
CREATE TYPE "public"."component_platform_new" AS ENUM('web', 'compose', 'xml', 'ios');--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "platform" "component_platform_new" NOT NULL DEFAULT 'web';--> statement-breakpoint
ALTER TABLE "components" ALTER COLUMN "platform" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "property_platform_params" ALTER COLUMN "platform" SET DATA TYPE "component_platform_new" USING "platform"::text::"component_platform_new";--> statement-breakpoint

-- ── 4. Колонки и ограничения ──────────────────────────────────────────────────────────────────
ALTER TABLE "appearances" DROP CONSTRAINT "appearances_ds_component_name_platform_unique";--> statement-breakpoint
ALTER TABLE "appearances" DROP COLUMN "platform";--> statement-breakpoint
ALTER TABLE "properties" DROP COLUMN "platform";--> statement-breakpoint
DROP TYPE "public"."component_platform";--> statement-breakpoint
DROP TYPE "public"."property_platform";--> statement-breakpoint
ALTER TYPE "public"."component_platform_new" RENAME TO "component_platform";--> statement-breakpoint
DROP INDEX "components_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "components_name_platform_unique" ON "components" USING btree ("name","platform");--> statement-breakpoint
ALTER TABLE "appearances" ADD CONSTRAINT "appearances_ds_component_name_unique" UNIQUE NULLS NOT DISTINCT("design_system_id","component_id","name");--> statement-breakpoint
ALTER TABLE "property_platform_params" ADD COLUMN "deprecated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property_platform_params" ADD COLUMN "deprecated_message" text;--> statement-breakpoint
ALTER TABLE "property_platform_params" ADD CONSTRAINT "ppp_deprecated_message_requires_deprecated" CHECK ("property_platform_params"."deprecated" or "property_platform_params"."deprecated_message" is null);--> statement-breakpoint

-- ── 5. Платформа алиаса равна платформе компонента ────────────────────────────────────────────
-- Алиас принадлежит свойству, свойство — компоненту. Внешним ключом это не выразить.
CREATE FUNCTION ppp_platform_matches_component() RETURNS trigger AS $$
DECLARE
  component_platform "component_platform";
BEGIN
  SELECT c.platform INTO component_platform
  FROM properties p JOIN components c ON c.id = p.component_id
  WHERE p.id = NEW.property_id;
  IF component_platform IS DISTINCT FROM NEW.platform THEN
    RAISE EXCEPTION 'Алиас платформы % не может принадлежать свойству компонента платформы %',
      NEW.platform, component_platform;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER ppp_platform_matches_component
  BEFORE INSERT OR UPDATE OF platform, property_id ON property_platform_params
  FOR EACH ROW EXECUTE FUNCTION ppp_platform_matches_component();--> statement-breakpoint

-- ── 6. Финальные проверки ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  b migration_0007_before%ROWTYPE;
  n integer;
BEGIN
  SELECT * INTO b FROM migration_0007_before;

  SELECT count(*) INTO n FROM property_platform_params pp
  JOIN properties p ON p.id = pp.property_id
  JOIN components c ON c.id = p.component_id
  WHERE c.platform <> pp.platform;
  IF n > 0 THEN
    RAISE EXCEPTION 'Миграция 0007: % алиасов не совпадают по платформе с компонентом', n;
  END IF;

  IF (SELECT count(*) FROM appearances) <> b.appearances
     OR (SELECT count(*) FROM variation_property_values) <> b.variation_values
     OR (SELECT count(*) FROM invariant_property_values) <> b.invariant_values
     OR (SELECT count(*) FROM variations) <> b.variations
     OR (SELECT count(*) FROM styles) <> b.styles
     OR (SELECT count(*) FROM design_system_components) <> b.links THEN
    RAISE EXCEPTION 'Миграция 0007: изменилось число строк контента дизайн-систем';
  END IF;
END $$;
--> statement-breakpoint

DROP TABLE migration_0007_before, migration_0007_native_components;
