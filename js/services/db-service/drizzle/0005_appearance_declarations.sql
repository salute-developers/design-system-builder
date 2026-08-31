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
