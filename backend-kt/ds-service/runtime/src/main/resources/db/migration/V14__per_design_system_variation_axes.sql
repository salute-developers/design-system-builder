-- Оси вариации принадлежат дизайн-системе и версионируются как стили (change per-design-system-variation-axes).
-- До этой миграции `variations` была общим каталогом компонента: одну запись использовали все дизайн-системы.
-- Миграция размножает ось по дизайн-системам, которые её используют или подключили компонент, переносит на копии
-- все ссылки своей системы (стили, объявления осей, reuse-конфигурации, роли осей в редакциях оформлений),
-- а затем переносит имя и описание оси в редакции `variation_revisions`.

ALTER TABLE variations ADD COLUMN design_system_id uuid;
ALTER TABLE property_variations ADD COLUMN design_system_id uuid;

-- Имя оси уникально внутри дизайн-системы и компонента; на разрешённом состоянии это проверяет триггер ниже.
DROP INDEX variations_component_id_name_unique;

-- Каждая пара (общая ось, дизайн-система-пользователь) получает собственную ось. Исходный идентификатор остаётся
-- за первой по времени создания дизайн-системой, остальные получают копии с новыми идентификаторами.
CREATE TEMPORARY TABLE variation_owner_map ON COMMIT DROP AS
WITH usage AS (
    SELECT variation_id AS old_id, design_system_id FROM styles
    UNION SELECT variation_id, design_system_id FROM appearance_variations
    UNION SELECT variation_id, design_system_id FROM component_reuse_config_revisions
    UNION SELECT root_variation_id, design_system_id FROM appearance_revisions WHERE root_variation_id IS NOT NULL
    UNION SELECT color_scheme_variation_id, design_system_id FROM appearance_revisions
        WHERE color_scheme_variation_id IS NOT NULL
    UNION SELECT variation.id, link.design_system_id
        FROM variations variation JOIN design_system_components link ON link.component_id = variation.component_id
),
ranked AS (
    SELECT usage.old_id, usage.design_system_id,
           row_number() OVER (PARTITION BY usage.old_id ORDER BY owner.created_at, owner.id) AS owner_rank
    FROM usage JOIN design_systems owner ON owner.id = usage.design_system_id
)
SELECT old_id, design_system_id,
       CASE WHEN owner_rank = 1 THEN old_id ELSE gen_random_uuid() END AS new_id
FROM ranked;

INSERT INTO variations (id, component_id, name, description, created_at, updated_at, design_system_id)
SELECT map.new_id, variation.component_id, variation.name, variation.description,
       variation.created_at, variation.updated_at, map.design_system_id
FROM variation_owner_map map
JOIN variations variation ON variation.id = map.old_id
WHERE map.new_id <> map.old_id;

UPDATE variations variation SET design_system_id = map.design_system_id
FROM variation_owner_map map
WHERE map.old_id = variation.id AND map.new_id = variation.id;

-- Ось, которую не использует ни одна дизайн-система и компонент которой ни к одной не подключён, не нужна.
DELETE FROM variations WHERE design_system_id IS NULL;

INSERT INTO property_variations (property_id, variation_id, created_at, updated_at)
SELECT link.property_id, map.new_id, link.created_at, link.updated_at
FROM property_variations link
JOIN variation_owner_map map ON map.old_id = link.variation_id
WHERE map.new_id <> map.old_id;

UPDATE property_variations link SET design_system_id = variation.design_system_id
FROM variations variation
WHERE variation.id = link.variation_id;

-- Ссылки своей системы переводятся на её копию оси. Редакции неизменяемы: триггеры черновика отключаются на время
-- переноса, как при заполнении в V12. Роли осей оформления ссылаются на объявления составным ключом,
-- поэтому ключи снимаются на время переноса и возвращаются после него.
ALTER TABLE appearance_revisions DISABLE TRIGGER USER;
ALTER TABLE component_reuse_config_revisions DISABLE TRIGGER USER;
ALTER TABLE appearance_revisions
    DROP CONSTRAINT ar_root_axis_fk,
    DROP CONSTRAINT ar_color_axis_fk;

UPDATE styles style SET variation_id = map.new_id
FROM variation_owner_map map
WHERE map.old_id = style.variation_id AND map.design_system_id = style.design_system_id
  AND map.new_id <> map.old_id;

UPDATE appearance_variations axis SET variation_id = map.new_id
FROM variation_owner_map map
WHERE map.old_id = axis.variation_id AND map.design_system_id = axis.design_system_id
  AND map.new_id <> map.old_id;

UPDATE component_reuse_config_revisions revision SET variation_id = map.new_id
FROM variation_owner_map map
WHERE map.old_id = revision.variation_id AND map.design_system_id = revision.design_system_id
  AND map.new_id <> map.old_id;

UPDATE appearance_revisions revision SET
    root_variation_id = COALESCE((
        SELECT map.new_id FROM variation_owner_map map
        WHERE map.old_id = revision.root_variation_id AND map.design_system_id = revision.design_system_id
    ), revision.root_variation_id),
    color_scheme_variation_id = COALESCE((
        SELECT map.new_id FROM variation_owner_map map
        WHERE map.old_id = revision.color_scheme_variation_id AND map.design_system_id = revision.design_system_id
    ), revision.color_scheme_variation_id)
WHERE revision.root_variation_id IS NOT NULL OR revision.color_scheme_variation_id IS NOT NULL;

ALTER TABLE appearance_revisions
    ADD CONSTRAINT ar_root_axis_fk FOREIGN KEY (appearance_id, root_variation_id, design_system_id)
        REFERENCES appearance_variations (appearance_id, variation_id, design_system_id),
    ADD CONSTRAINT ar_color_axis_fk FOREIGN KEY (appearance_id, color_scheme_variation_id, design_system_id)
        REFERENCES appearance_variations (appearance_id, variation_id, design_system_id);
ALTER TABLE appearance_revisions ENABLE TRIGGER USER;
ALTER TABLE component_reuse_config_revisions ENABLE TRIGGER USER;

-- Редакции оси: имя и описание переезжают из устойчивой записи в исходную редакцию каждой дизайн-системы.
CREATE TABLE variation_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text NOT NULL,
    description text,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO variation_revisions (
    variation_id, design_system_id, design_system_version_id, version_sequence_number, name, description, updated_at
)
SELECT variation.id, variation.design_system_id, boundary.id, boundary.sequence_number,
       variation.name, variation.description, variation.updated_at
FROM variations variation
JOIN design_system_versions boundary
    ON boundary.design_system_id = variation.design_system_id AND boundary.status = 'baseline';

DO $$
BEGIN
    IF (SELECT count(*) FROM variations) <> (SELECT count(*) FROM variation_revisions) THEN
        RAISE EXCEPTION 'variations without baseline revision: %',
            (SELECT count(*) FROM variations) - (SELECT count(*) FROM variation_revisions);
    END IF;
END;
$$;

ALTER TABLE variations ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE property_variations ALTER COLUMN design_system_id SET NOT NULL;

ALTER TABLE variations
    ADD CONSTRAINT variations_design_system_id_design_systems_id_fk
        FOREIGN KEY (design_system_id) REFERENCES design_systems (id) ON DELETE CASCADE,
    ADD CONSTRAINT variations_id_ds_unique UNIQUE (id, design_system_id);
CREATE INDEX variations_design_system_component_idx ON variations (design_system_id, component_id);

ALTER TABLE variations
    DROP COLUMN name CASCADE,
    DROP COLUMN description CASCADE,
    DROP COLUMN updated_at CASCADE;

-- Ссылка на ось проверяется вместе с дизайн-системой: оформление, стиль и reuse-конфигурация одной системы не могут
-- сослаться на ось другой. Проверка отложена до конца транзакции, чтобы каскадное удаление дизайн-системы удаляло
-- ссылки и ось в любом порядке, а удаление компонента из общего каталога по-прежнему не стирало конфигурации.
ALTER TABLE styles
    DROP CONSTRAINT styles_variation_id_variations_id_fk,
    ADD CONSTRAINT styles_variation_ds_fk FOREIGN KEY (variation_id, design_system_id)
        REFERENCES variations (id, design_system_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appearance_variations
    DROP CONSTRAINT appearance_variations_variation_id_variations_id_fk,
    ADD CONSTRAINT av_variation_ds_fk FOREIGN KEY (variation_id, design_system_id)
        REFERENCES variations (id, design_system_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE component_reuse_config_revisions
    DROP CONSTRAINT crcr_variation_fk,
    ADD CONSTRAINT crcr_variation_ds_fk FOREIGN KEY (variation_id, design_system_id)
        REFERENCES variations (id, design_system_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE property_variations
    DROP CONSTRAINT property_variations_variation_id_variations_id_fk,
    ADD CONSTRAINT pv_variation_ds_fk FOREIGN KEY (variation_id, design_system_id)
        REFERENCES variations (id, design_system_id) ON DELETE CASCADE;
CREATE INDEX pv_design_system_idx ON property_variations (design_system_id, variation_id);

ALTER TABLE variation_revisions
    ADD CONSTRAINT vrev_entity_fk FOREIGN KEY (variation_id, design_system_id)
        REFERENCES variations (id, design_system_id),
    ADD CONSTRAINT vrev_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT vrev_entity_version_unique UNIQUE (variation_id, design_system_version_id);
CREATE INDEX vrev_boundary_idx ON variation_revisions (variation_id, version_sequence_number DESC);
CREATE INDEX vrev_version_idx ON variation_revisions (design_system_version_id);

-- Те же триггеры, что у style_revisions: граница черновика, журнал, уведомления и уникальность имени оси.
CREATE TRIGGER variation_revisions_touch_draft BEFORE INSERT OR UPDATE OR DELETE ON variation_revisions
    FOR EACH ROW EXECUTE FUNCTION touch_design_system_draft_revision();
CREATE CONSTRAINT TRIGGER variation_revisions_bump_draft AFTER INSERT OR DELETE ON variation_revisions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_design_system_draft_revision();
CREATE TRIGGER variation_revisions_collect_invalidation_scope AFTER INSERT OR DELETE ON variation_revisions
    FOR EACH ROW EXECUTE FUNCTION collect_draft_invalidation_scope('component-configurations');
CREATE TRIGGER variation_revisions_compact AFTER INSERT ON variation_revisions
    FOR EACH ROW EXECUTE FUNCTION compact_subject_draft_revision('variation_revisions', 'variations', 'variation_id');
CREATE TRIGGER variation_revisions_edit_state AFTER INSERT ON variation_revisions
    FOR EACH ROW EXECUTE FUNCTION track_subject_edit_revision('variation', 'variation_id');
CREATE CONSTRAINT TRIGGER variation_resolved_name_unique AFTER INSERT OR DELETE ON variation_revisions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    EXECUTE FUNCTION enforce_resolved_revision_unique('variations', 'variation_id', 'component_id,name');
CREATE TRIGGER variation_revisions_reset_integrity BEFORE INSERT OR DELETE ON variation_revisions
    FOR EACH ROW EXECUTE FUNCTION clear_revision_integrity_checks();
