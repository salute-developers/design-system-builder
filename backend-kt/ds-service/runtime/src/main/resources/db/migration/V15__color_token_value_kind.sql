-- add-color-token-gradients: вид значения цветового токена.
-- Тип семейства следует из значений: градиентные семейства без градиентной функции в web становятся цветовыми,
-- сплошные значения iOS и Android хранятся строкой. Строки редакций правятся на месте на всех границах версий,
-- без черновых редакций и записей журнала; прежние тип и значения изменённых строк сохраняются в резервной таблице.

-- Признак своего значения платформы: путь `/overridden` предметной редакции значения.
ALTER TABLE token_value_revisions ADD COLUMN overridden boolean NOT NULL DEFAULT false;
ALTER TABLE token_value_creation_baselines ADD COLUMN overridden boolean NOT NULL DEFAULT false;

-- Для ручного восстановления: строки редакций и основы создания темы до правки V15.
CREATE TABLE v15_color_token_backup (
    id bigserial PRIMARY KEY,
    source_table text NOT NULL,
    row_id uuid NOT NULL,
    design_system_version_id uuid,
    previous_type token_type,
    previous_palette_id uuid,
    previous_value jsonb,
    backed_up_at timestamp NOT NULL DEFAULT now(),
    CHECK (source_table IN ('token_revisions', 'token_value_revisions', 'token_value_creation_baselines'))
);

-- Первый HEX значения: строка или строковый элемент массива по порядку.
CREATE FUNCTION v15_first_hex(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT item.element #>> '{}'
    FROM jsonb_array_elements(
        CASE jsonb_typeof(value)
            WHEN 'array' THEN value
            WHEN 'string' THEN jsonb_build_array(value)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS item(element, position)
    WHERE jsonb_typeof(item.element) = 'string'
      AND item.element #>> '{}' ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
    ORDER BY item.position
    LIMIT 1
$$;

-- Сплошной HEX: строка или массив из одной строки.
CREATE FUNCTION v15_solid_hex(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT candidate.color
    FROM (
        SELECT CASE
            WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
            WHEN jsonb_typeof(value) = 'array' AND jsonb_array_length(value) = 1
                AND jsonb_typeof(value -> 0) = 'string' THEN value ->> 0
        END AS color
    ) candidate
    WHERE candidate.color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'
$$;

-- Семейство: дизайн-система, первый сегмент и имя без подгруппы и состояния, тип `gradient`.
CREATE TEMP TABLE v15_gradient_member ON COMMIT DROP AS
SELECT DISTINCT
    revision.token_id,
    revision.design_system_id,
    split_part(revision.name, '.', 1) AS family_group,
    regexp_replace(split_part(revision.name, '.', 3), '-(hover|active|brightness)$', '') AS family_name
FROM token_revisions revision
WHERE revision.type = 'gradient'
  AND array_length(string_to_array(revision.name, '.'), 1) = 3;

-- Градиентное семейство остаётся градиентным, если хотя бы одно web-значение какого-либо члена в какой-либо теме
-- и на какой-либо границе — градиентная функция; иначе его нативные градиенты — заглушки сида.
CREATE TEMP TABLE v15_gradient_family ON COMMIT DROP AS
SELECT
    member.design_system_id,
    member.family_group,
    member.family_name,
    bool_or(
        EXISTS (
            SELECT 1
            FROM token_values value
            JOIN token_value_revisions revision ON revision.token_value_id = value.id
            WHERE value.token_id = member.token_id
              AND value.platform = 'web'
              AND revision.value::text ~ '(linear|radial|conic)-gradient\('
        )
        OR EXISTS (
            SELECT 1
            FROM token_values value
            JOIN token_value_creation_baselines baseline ON baseline.token_value_id = value.id
            WHERE value.token_id = member.token_id
              AND value.platform = 'web'
              AND baseline.value::text ~ '(linear|radial|conic)-gradient\('
        )
    ) AS real_gradient
FROM v15_gradient_member member
GROUP BY member.design_system_id, member.family_group, member.family_name;

CREATE TEMP TABLE v15_real_token ON COMMIT DROP AS
SELECT DISTINCT member.token_id
FROM v15_gradient_member member
JOIN v15_gradient_family family
  ON family.design_system_id = member.design_system_id
 AND family.family_group = member.family_group
 AND family.family_name = member.family_name
WHERE family.real_gradient;

CREATE TEMP TABLE v15_stub_token ON COMMIT DROP AS
SELECT DISTINCT member.token_id
FROM v15_gradient_member member
WHERE NOT EXISTS (SELECT 1 FROM v15_real_token real_token WHERE real_token.token_id = member.token_id);

-- Строки опубликованных и исходных границ неизменяемы для приложения; правка на месте только на время миграции.
ALTER TABLE token_revisions DISABLE TRIGGER token_revisions_touch_draft;
ALTER TABLE token_value_revisions DISABLE TRIGGER token_value_revisions_touch_draft;

-- 1. Семейства-заглушки становятся цветовыми на всех границах версий.
WITH changed AS (
    UPDATE token_revisions revision
    SET type = 'color'
    FROM token_revisions previous
    WHERE previous.id = revision.id
      AND revision.type = 'gradient'
      AND revision.token_id IN (SELECT token_id FROM v15_stub_token)
    RETURNING revision.id, previous.type AS previous_type
)
INSERT INTO v15_color_token_backup (source_table, row_id, previous_type)
SELECT 'token_revisions', id, previous_type FROM changed;

-- 2. Web-значение семейства-заглушки — массив из первого HEX.
WITH target AS (
    SELECT revision.id, revision.palette_id, revision.value, jsonb_build_array(v15_first_hex(revision.value)) AS next
    FROM token_value_revisions revision
    JOIN token_values value ON value.id = revision.token_value_id
    WHERE value.platform = 'web'
      AND NOT revision.deleted
      AND value.token_id IN (SELECT token_id FROM v15_stub_token)
      AND v15_first_hex(revision.value) IS NOT NULL
), changed AS (
    UPDATE token_value_revisions revision
    SET value = target.next
    FROM target
    WHERE revision.id = target.id AND revision.value IS DISTINCT FROM target.next
    RETURNING revision.id, target.palette_id, target.value
)
INSERT INTO v15_color_token_backup (source_table, row_id, previous_palette_id, previous_value)
SELECT 'token_value_revisions', id, palette_id, value FROM changed;

-- 3. Значения iOS и Android семейства-заглушки — копия действующего на той же границе web-значения той же темы
--    и режима; 4. у членов настоящего градиентного семейства со сплошным web-HEX — тот же HEX.
WITH target AS (
    SELECT
        native.id,
        native.palette_id,
        native.value,
        CASE WHEN native_value.token_id IN (SELECT token_id FROM v15_stub_token)
            THEN web.palette_id
        END AS next_palette_id,
        CASE WHEN native_value.token_id IN (SELECT token_id FROM v15_stub_token)
            THEN web.value
            ELSE jsonb_build_array(v15_solid_hex(web.value))
        END AS next_value
    FROM token_value_revisions native
    JOIN token_values native_value ON native_value.id = native.token_value_id
    JOIN token_values web_value
      ON web_value.token_id = native_value.token_id
     AND web_value.tenant_id = native_value.tenant_id
     AND web_value.mode IS NOT DISTINCT FROM native_value.mode
     AND web_value.platform = 'web'
    JOIN LATERAL (
        SELECT candidate.palette_id, candidate.value, candidate.deleted
        FROM token_value_revisions candidate
        WHERE candidate.token_value_id = web_value.id
          AND candidate.version_sequence_number <= native.version_sequence_number
        ORDER BY candidate.version_sequence_number DESC
        LIMIT 1
    ) web ON NOT web.deleted
    WHERE native_value.platform IN ('ios', 'android')
      AND NOT native.deleted
      AND (
          native_value.token_id IN (SELECT token_id FROM v15_stub_token)
          OR (
              native_value.token_id IN (SELECT token_id FROM v15_real_token)
              AND web.palette_id IS NULL
              AND v15_solid_hex(web.value) IS NOT NULL
          )
      )
), changed AS (
    UPDATE token_value_revisions revision
    SET value = target.next_value, palette_id = target.next_palette_id
    FROM target
    WHERE revision.id = target.id
      AND (revision.value IS DISTINCT FROM target.next_value OR revision.palette_id IS DISTINCT FROM target.next_palette_id)
    RETURNING revision.id, target.palette_id, target.value
)
INSERT INTO v15_color_token_backup (source_table, row_id, previous_palette_id, previous_value)
SELECT 'token_value_revisions', id, palette_id, value FROM changed;

ALTER TABLE token_value_revisions ENABLE TRIGGER token_value_revisions_touch_draft;
ALTER TABLE token_revisions ENABLE TRIGGER token_revisions_touch_draft;

-- Основа создания темы в черновике сравнивается журналом с текущими значениями и приводится по тем же правилам,
-- иначе правка редакций дала бы в журнале записи новых тем.
WITH target AS (
    SELECT baseline.design_system_version_id, baseline.token_value_id, baseline.palette_id, baseline.value,
           jsonb_build_array(v15_first_hex(baseline.value)) AS next
    FROM token_value_creation_baselines baseline
    JOIN token_values value ON value.id = baseline.token_value_id
    WHERE value.platform = 'web'
      AND value.token_id IN (SELECT token_id FROM v15_stub_token)
      AND v15_first_hex(baseline.value) IS NOT NULL
), changed AS (
    UPDATE token_value_creation_baselines baseline
    SET value = target.next
    FROM target
    WHERE baseline.design_system_version_id = target.design_system_version_id
      AND baseline.token_value_id = target.token_value_id
      AND baseline.value IS DISTINCT FROM target.next
    RETURNING baseline.token_value_id, baseline.design_system_version_id, target.palette_id, target.value
)
INSERT INTO v15_color_token_backup (
    source_table, row_id, design_system_version_id, previous_palette_id, previous_value
)
SELECT 'token_value_creation_baselines', token_value_id, design_system_version_id, palette_id, value FROM changed;

WITH target AS (
    SELECT
        native.design_system_version_id,
        native.token_value_id,
        native.palette_id,
        native.value,
        CASE WHEN native_value.token_id IN (SELECT token_id FROM v15_stub_token)
            THEN web.palette_id
        END AS next_palette_id,
        CASE WHEN native_value.token_id IN (SELECT token_id FROM v15_stub_token)
            THEN web.value
            ELSE jsonb_build_array(v15_solid_hex(web.value))
        END AS next_value
    FROM token_value_creation_baselines native
    JOIN token_values native_value ON native_value.id = native.token_value_id
    JOIN token_values web_value
      ON web_value.token_id = native_value.token_id
     AND web_value.tenant_id = native_value.tenant_id
     AND web_value.mode IS NOT DISTINCT FROM native_value.mode
     AND web_value.platform = 'web'
    JOIN token_value_creation_baselines web
      ON web.token_value_id = web_value.id
     AND web.design_system_version_id = native.design_system_version_id
    WHERE native_value.platform IN ('ios', 'android')
      AND (
          native_value.token_id IN (SELECT token_id FROM v15_stub_token)
          OR (
              native_value.token_id IN (SELECT token_id FROM v15_real_token)
              AND web.palette_id IS NULL
              AND v15_solid_hex(web.value) IS NOT NULL
          )
      )
), changed AS (
    UPDATE token_value_creation_baselines baseline
    SET value = target.next_value, palette_id = target.next_palette_id
    FROM target
    WHERE baseline.design_system_version_id = target.design_system_version_id
      AND baseline.token_value_id = target.token_value_id
      AND (baseline.value IS DISTINCT FROM target.next_value OR baseline.palette_id IS DISTINCT FROM target.next_palette_id)
    RETURNING baseline.token_value_id, baseline.design_system_version_id, target.palette_id, target.value
)
INSERT INTO v15_color_token_backup (
    source_table, row_id, design_system_version_id, previous_palette_id, previous_value
)
SELECT 'token_value_creation_baselines', token_value_id, design_system_version_id, palette_id, value FROM changed;

DROP FUNCTION v15_solid_hex(jsonb);
DROP FUNCTION v15_first_hex(jsonb);
