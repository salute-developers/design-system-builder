-- Палитра темы: независимая копия общей палитры (шаблона) и правки темы поверх неё (add-theme-palette-api).

CREATE TYPE "public"."palette_group_kind" AS ENUM ('system', 'custom');
CREATE TYPE "public"."palette_ramp_origin" AS ENUM ('template', 'rebuild');

-- Копия шаблона на момент создания палитры темы; после создания не меняется.
CREATE TABLE "tenant_palette_template" (
    "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
    "type" "palette_type" NOT NULL,
    "shade" text NOT NULL,
    "step" integer NOT NULL,
    "value" text NOT NULL,
    PRIMARY KEY ("tenant_id", "type", "shade", "step")
);

CREATE TABLE "tenant_palette_groups" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
    "kind" "palette_group_kind" NOT NULL,
    "system_key" text,
    "label" text NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "tenant_palette_groups_system_key_check" CHECK (("kind" = 'system') = ("system_key" IS NOT NULL)),
    CONSTRAINT "tenant_palette_groups_system_key_value_check"
        CHECK ("system_key" IS NULL OR "system_key" IN ('neutral', 'accent', 'status', 'data', 'syntax')),
    -- Цель составного внешнего ключа привязок: группа привязки принадлежит той же теме.
    CONSTRAINT "tenant_palette_groups_tenant_id_id_unique" UNIQUE ("tenant_id", "id")
);
CREATE UNIQUE INDEX "tenant_palette_groups_system_key_unique"
    ON "tenant_palette_groups" ("tenant_id", "system_key") WHERE "system_key" IS NOT NULL;
CREATE UNIQUE INDEX "tenant_palette_groups_label_ci_unique" ON "tenant_palette_groups" ("tenant_id", lower("label"));

-- Растяжка группы хранится, только когда её добавили или изменили; растяжки по ссылкам токенов вычисляются.
CREATE TABLE "tenant_palette_ramps" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "group_id" uuid NOT NULL REFERENCES "tenant_palette_groups" ("id") ON DELETE CASCADE,
    "slot_type" "palette_type" NOT NULL,
    "slot_shade" text NOT NULL,
    "source_type" "palette_type" NOT NULL,
    "source_shade" text NOT NULL,
    "added" boolean DEFAULT false NOT NULL,
    "origin" "palette_ramp_origin" DEFAULT 'template' NOT NULL,
    "anchor_step" integer,
    "anchor_value" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "tenant_palette_ramps_slot_unique" UNIQUE ("group_id", "slot_type", "slot_shade")
);

CREATE TABLE "tenant_palette_steps" (
    "ramp_id" uuid NOT NULL REFERENCES "tenant_palette_ramps" ("id") ON DELETE CASCADE,
    "step" integer NOT NULL,
    "value" text NOT NULL,
    PRIMARY KEY ("ramp_id", "step")
);

-- Только явные привязки токенов к группам; группа по умолчанию вычисляется по имени токена.
CREATE TABLE "tenant_palette_token_groups" (
    "tenant_id" uuid NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
    "token_id" uuid NOT NULL REFERENCES "tokens" ("id") ON DELETE CASCADE,
    "group_id" uuid NOT NULL,
    PRIMARY KEY ("tenant_id", "token_id"),
    CONSTRAINT "tenant_palette_token_groups_group_fk" FOREIGN KEY ("tenant_id", "group_id")
        REFERENCES "tenant_palette_groups" ("tenant_id", "id") ON DELETE CASCADE
);

-- Существующие темы получают копию текущей общей палитры и пять системных групп.
INSERT INTO "tenant_palette_template" ("tenant_id", "type", "shade", "step", "value")
SELECT "tenants"."id", "palette"."type", "palette"."shade", "palette"."saturation", "palette"."value"
FROM "tenants" CROSS JOIN "palette";

INSERT INTO "tenant_palette_groups" ("tenant_id", "kind", "system_key", "label", "position")
SELECT "tenants"."id", 'system', "groups"."system_key", "groups"."label", "groups"."position"
FROM "tenants"
CROSS JOIN (VALUES
    ('neutral', 'Neutral', 0),
    ('accent', 'Accent', 1),
    ('status', 'Статус', 2),
    ('data', 'Data', 3),
    ('syntax', 'Syntax', 4)
) AS "groups" ("system_key", "label", "position");
