-- Группы и подгруппы токенов дизайн-системы и позиция токена в них (add-color-token-groups).

CREATE TYPE "public"."token_group_kind" AS ENUM ('color');

-- Дерево не глубже двух уровней: группа (`parent_id IS NULL`, есть `code`) и её подгруппы (без `code`).
-- Глубину проверяют операции ds-service: ограничением её не выразить без триггера.
CREATE TABLE "token_groups" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "design_system_id" uuid NOT NULL REFERENCES "design_systems" ("id") ON DELETE CASCADE,
    "kind" "token_group_kind" NOT NULL,
    "parent_id" uuid,
    "code" text,
    "label" text NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "token_groups_code_check" CHECK (("parent_id" IS NULL) = ("code" IS NOT NULL)),
    CONSTRAINT "token_groups_code_value_check" CHECK ("code" IS NULL OR "code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT "token_groups_label_check" CHECK (btrim("label") <> ''),
    -- Цель составных внешних ключей: родитель и токены принадлежат той же дизайн-системе.
    CONSTRAINT "token_groups_scope_unique" UNIQUE ("design_system_id", "kind", "id"),
    CONSTRAINT "token_groups_design_system_id_id_unique" UNIQUE ("design_system_id", "id"),
    CONSTRAINT "token_groups_parent_fk" FOREIGN KEY ("design_system_id", "kind", "parent_id")
        REFERENCES "token_groups" ("design_system_id", "kind", "id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "token_groups_label_ci_unique" ON "token_groups"
    ("design_system_id", "kind", coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid), lower("label"));
CREATE INDEX "token_groups_parent_id_idx" ON "token_groups" ("parent_id");

ALTER TABLE "tokens" ADD COLUMN "group_id" uuid;
ALTER TABLE "tokens" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
-- Удаление группы сбрасывает ссылку только у `group_id`: `design_system_id` токена остаётся.
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_group_fk" FOREIGN KEY ("design_system_id", "group_id")
    REFERENCES "token_groups" ("design_system_id", "id") ON DELETE SET NULL ("group_id");
CREATE INDEX "tokens_group_id_idx" ON "tokens" ("group_id");

-- Семейства цветовых токенов дизайн-системы без группы и их место на экране «Цвета» до появления групп: раздел по
-- группе имени, категория по правилу группы палитры по умолчанию и виду Solid или Transparent.
CREATE FUNCTION "token_groups_color_families"("ds" uuid)
RETURNS TABLE (
    "token_type" "token_type",
    "grp" text,
    "family" text,
    "section_order" integer,
    "section_label" text,
    "subgroup_label" text,
    "rank" bigint,
    "first_created" timestamp,
    "token_ids" uuid[]
)
LANGUAGE sql STABLE AS $$
    WITH "members" AS (
        SELECT "id", "type", "created_at",
            split_part("name", '.', 1) AS "grp",
            split_part("name", '.', 2) AS "context",
            regexp_replace(split_part("name", '.', 3), '-(hover|active|brightness)$', '') AS "family"
        FROM "tokens"
        WHERE "design_system_id" = "ds"
            AND "group_id" IS NULL
            AND "type" IN ('color', 'gradient')
            AND "name" ~ '^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+(-[a-z0-9]+)*$'
    ),
    "placed" AS (
        SELECT *,
            CASE
                WHEN "grp" = 'surface' AND "family" = 'read-only' THEN 6
                ELSE array_position(ARRAY['text', 'surface', 'outline', 'background', 'overlay', 'data'], "grp") - 1
            END AS "section_order"
        FROM "members"
        WHERE "context" IN ('default', 'inverse', CASE WHEN "grp" = 'background' THEN 'dark' ELSE 'on-dark' END,
            CASE WHEN "grp" = 'background' THEN 'light' ELSE 'on-light' END)
    ),
    "families" AS (
        SELECT "type", "grp", "family", "section_order",
            (ARRAY['Text & Icons', 'Surfaces', 'Outlines', 'BG', 'Overlays', 'Data', 'Technical'])["section_order" + 1]
                AS "section_label",
            CASE
                WHEN "section_order" >= 3 THEN 'Default'
                ELSE CASE
                    WHEN "family" ~ 'accent|promo' THEN 'Accent'
                    WHEN "family" ~ 'positive|negative|warning|info' THEN 'Status'
                    ELSE 'General'
                END || CASE
                    WHEN "section_order" NOT IN (1, 2) THEN ''
                    WHEN "family" LIKE 'transparent-%' OR "family" = 'clear' THEN ' / Transparent'
                    ELSE ' / Solid'
                END
            END AS "subgroup_label",
            min("created_at") AS "first_created",
            array_agg("id") AS "token_ids"
        FROM "placed"
        WHERE "section_order" IS NOT NULL
        GROUP BY "type", "grp", "family", "section_order"
    )
    SELECT "type", "grp", "family", "section_order", "section_label", "subgroup_label",
        row_number() OVER (
            PARTITION BY "section_order", "subgroup_label" ORDER BY "first_created", "family", "type"
        ) - 1,
        "first_created", "token_ids"
    FROM "families"
$$;

-- Раскладывает цветовые токены дизайн-системы по группам и подгруппам, если групп вида `color` у неё ещё нет.
-- Вызывается миграцией для существующих дизайн-систем и ds-service для созданных в обход него (legacy db-service).
CREATE FUNCTION "token_groups_initialize_color"("ds" uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Одновременные вызовы для одной дизайн-системы выполняются по очереди.
    PERFORM 1 FROM "design_systems" WHERE "id" = "ds" FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "token_groups" WHERE "design_system_id" = "ds" AND "kind" = 'color') THEN
        RETURN;
    END IF;

    -- Группы — разделы с токенами в порядке экрана; у Technical код `surface`, как у Surfaces.
    INSERT INTO "token_groups" ("design_system_id", "kind", "parent_id", "code", "label", "position")
    SELECT "ds", 'color', NULL,
        CASE WHEN "s"."section_order" = 6 THEN 'surface' ELSE "s"."grp" END,
        "s"."section_label",
        row_number() OVER (ORDER BY "s"."section_order") - 1
    FROM (
        SELECT DISTINCT "f"."section_order", "f"."section_label", "f"."grp"
        FROM "token_groups_color_families"("ds") AS "f"
    ) AS "s";

    -- Подгруппы — категории раздела в порядке первого токена.
    INSERT INTO "token_groups" ("design_system_id", "kind", "parent_id", "code", "label", "position")
    SELECT "ds", 'color', "g"."id", NULL, "f"."subgroup_label",
        row_number() OVER (PARTITION BY "g"."id" ORDER BY min("f"."first_created"), min("f"."family")) - 1
    FROM "token_groups_color_families"("ds") AS "f"
    JOIN "token_groups" AS "g"
        ON "g"."design_system_id" = "ds" AND "g"."parent_id" IS NULL AND "g"."label" = "f"."section_label"
    GROUP BY "g"."id", "f"."subgroup_label";

    -- Все определения семейства — в одной подгруппе на одной позиции.
    UPDATE "tokens" AS "t" SET "group_id" = "placed"."subgroup_id", "position" = "placed"."rank"
    FROM (
        SELECT "sg"."id" AS "subgroup_id", "f"."rank", unnest("f"."token_ids") AS "token_id"
        FROM "token_groups_color_families"("ds") AS "f"
        JOIN "token_groups" AS "g"
            ON "g"."design_system_id" = "ds" AND "g"."parent_id" IS NULL AND "g"."label" = "f"."section_label"
        JOIN "token_groups" AS "sg" ON "sg"."parent_id" = "g"."id" AND "sg"."label" = "f"."subgroup_label"
    ) AS "placed"
    WHERE "t"."id" = "placed"."token_id";
END;
$$;

SELECT "token_groups_initialize_color"("id") FROM "design_systems";

-- Ссылка значения компонента на токен — `token_id`; имя токена текстом больше не дублируется.
UPDATE "variation_property_values" AS "v" SET "value" = NULL
FROM "tokens" AS "t"
WHERE "v"."token_id" = "t"."id" AND "v"."value" = "t"."name";

UPDATE "invariant_property_values" AS "v" SET "value" = NULL
FROM "tokens" AS "t"
WHERE "v"."token_id" = "t"."id" AND "v"."value" = "t"."name";
