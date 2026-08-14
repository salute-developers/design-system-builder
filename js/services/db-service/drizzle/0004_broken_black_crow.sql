ALTER TYPE "public"."property_type" ADD VALUE 'component_style';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'value';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'icon';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'boolean';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'gradient';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'blur';--> statement-breakpoint
ALTER TYPE "public"."property_type" ADD VALUE 'integer';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'activated';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'checked';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'indeterminate';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'error';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'text-inlined';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'collapsed';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'inactive';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'in-edit';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'vertical';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'dragging-over';--> statement-breakpoint
ALTER TYPE "public"."state" ADD VALUE 'expanded';--> statement-breakpoint
ALTER TABLE "style_combinations" ADD COLUMN "combination_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
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
), '');--> statement-breakpoint
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
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "sc_property_appearance_combination_unique" ON "style_combinations" USING btree ("property_id","appearance_id","combination_key");