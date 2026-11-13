-- Модель редактора оформления (change component-editor-model-api): отображаемые имена осей и значений осей
-- внутри оформления и признак конфигурации по умолчанию.

ALTER TABLE appearance_revisions
    ADD COLUMN is_default boolean NOT NULL DEFAULT false;
ALTER TABLE appearance_variation_revisions
    ADD COLUMN display_name text;
ALTER TABLE appearance_variation_value_revisions
    ADD COLUMN display_name text;

-- Для каждой пары (дизайн-система, компонент) конфигурацией по умолчанию становится оформление, имя которого
-- равно имени компонента без учёта регистра; при его отсутствии — созданное раньше остальных. Признак
-- записывается во все редакции выбранного оформления, потому что редакция хранит полный набор полей.
-- Редакции неизменяемы: триггеры блокируют UPDATE, поэтому на время заполнения они отключаются на этой таблице.
ALTER TABLE appearance_revisions DISABLE TRIGGER USER;

WITH latest AS (
    SELECT DISTINCT ON (revision.appearance_id)
           revision.appearance_id, revision.name, revision.deleted
    FROM appearance_revisions revision
    ORDER BY revision.appearance_id, revision.version_sequence_number DESC
),
candidates AS (
    SELECT appearance.id AS appearance_id,
           appearance.design_system_id,
           appearance.component_id,
           appearance.created_at,
           lower(btrim(coalesce(latest.name, ''))) = lower(btrim(component.name)) AS matches
    FROM appearances appearance
    JOIN latest ON latest.appearance_id = appearance.id AND NOT latest.deleted
    JOIN components component ON component.id = appearance.component_id
),
chosen AS (
    SELECT DISTINCT ON (design_system_id, component_id) appearance_id
    FROM candidates
    ORDER BY design_system_id, component_id, matches DESC, created_at, appearance_id
)
UPDATE appearance_revisions revision
SET is_default = true
FROM chosen
WHERE revision.appearance_id = chosen.appearance_id;

ALTER TABLE appearance_revisions ENABLE TRIGGER USER;
