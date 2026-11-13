-- Каталог иконок билдера (change add-icon-catalog).
-- Каталог общий для окружения и не привязан к проекту или дизайн-системе. SVG лежат в S3 под
-- <prefix>/icons/<load_id>/<size>/<Name>.svg, в БД хранятся только описание иконок и журнал загрузок.

CREATE TABLE "icon_catalog_loads" (
    "load_id" text PRIMARY KEY,
    "package_name" text NOT NULL,
    "package_version" text NOT NULL,
    "icon_count" integer NOT NULL,
    "loaded_by" text NOT NULL,
    "loaded_at" timestamp DEFAULT now() NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "icon_catalog_loads_load_id_check" CHECK ("load_id" ~ '^[0-9a-f]{12}$')
);

-- Не более одной активной загрузки.
CREATE UNIQUE INDEX "icon_catalog_loads_active_idx" ON "icon_catalog_loads" ((true)) WHERE "active";

CREATE INDEX "icon_catalog_loads_recency_idx" ON "icon_catalog_loads" ("loaded_at" DESC);

-- Текущий каталог; заменяется целиком при каждой записи. Связь с активной загрузкой логическая.
CREATE TABLE "icons" (
    "name" text PRIMARY KEY,
    "legacy_key" text NOT NULL,
    "style" text NOT NULL,
    "category" text,
    "aliases" text[] DEFAULT '{}' NOT NULL,
    "sizes" integer[] NOT NULL,
    "content_hash" text NOT NULL,
    CONSTRAINT "icons_name_check" CHECK ("name" ~ '^[A-Z][A-Za-z0-9_]*$'),
    CONSTRAINT "icons_style_check" CHECK ("style" IN ('outline', 'outline-bold', 'fill', 'none')),
    CONSTRAINT "icons_sizes_check" CHECK ("sizes" <@ ARRAY[16, 24, 36] AND cardinality("sizes") > 0),
    CONSTRAINT "icons_legacy_key_unique" UNIQUE ("legacy_key")
);
