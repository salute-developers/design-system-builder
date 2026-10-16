-- Этап 3: переключение на редакции, окончательные ограничения, индексы и правила конкурентной записи.

-- После заполнения редакций устойчивые таблицы оставляют только идентичность,
-- область дизайн-системы, неизменяемые связи и время создания.
-- Представления current_* намеренно не создаются: актуальная редакция выбирается репозиторием.

DROP TRIGGER IF EXISTS vpv_state_set_coherent ON variation_property_values;
DROP TRIGGER IF EXISTS ipv_state_set_coherent ON invariant_property_values;
DROP TRIGGER IF EXISTS scm_state_set_coherent ON style_combination_members;

-- Строка удаления хранит только устойчивую сущность, границу и deleted=true.
-- Для действующей редакции обязательность предметных полей сохраняют проверки.
ALTER TABLE appearance_variation_revisions ALTER COLUMN position DROP NOT NULL;
ALTER TABLE appearance_variation_revisions
    ADD CONSTRAINT avr_live_payload_required CHECK (deleted OR position IS NOT NULL);
ALTER TABLE appearance_variation_value_revisions
    ALTER COLUMN style_id DROP NOT NULL,
    ALTER COLUMN position DROP NOT NULL;
ALTER TABLE appearance_variation_value_revisions
    ADD CONSTRAINT avvr_live_payload_required CHECK (deleted OR (style_id IS NOT NULL AND position IS NOT NULL));
ALTER TABLE appearance_combination_revisions
    ALTER COLUMN combination_key DROP NOT NULL,
    ALTER COLUMN position DROP NOT NULL;
ALTER TABLE appearance_combination_revisions
    ADD CONSTRAINT acr_live_payload_required CHECK (deleted OR (combination_key IS NOT NULL AND position IS NOT NULL));
ALTER TABLE appearance_combination_member_revisions
    ALTER COLUMN style_id DROP NOT NULL,
    ALTER COLUMN position DROP NOT NULL;
ALTER TABLE appearance_combination_member_revisions
    ADD CONSTRAINT acmr_live_payload_required CHECK (deleted OR (style_id IS NOT NULL AND position IS NOT NULL));
ALTER TABLE invariant_property_value_revisions
    ALTER COLUMN position DROP NOT NULL,
    ALTER COLUMN state_set_id DROP NOT NULL;
ALTER TABLE invariant_property_value_revisions
    ADD CONSTRAINT ipvr_live_payload_required CHECK (deleted OR (position IS NOT NULL AND state_set_id IS NOT NULL));
ALTER TABLE variation_property_value_revisions
    ALTER COLUMN position DROP NOT NULL,
    ALTER COLUMN state_set_id DROP NOT NULL;
ALTER TABLE variation_property_value_revisions
    ADD CONSTRAINT vpvr_live_payload_required CHECK (deleted OR (position IS NOT NULL AND state_set_id IS NOT NULL));
ALTER TABLE style_combination_revisions
    ALTER COLUMN combination_key DROP NOT NULL,
    ALTER COLUMN value DROP NOT NULL,
    ALTER COLUMN position DROP NOT NULL,
    ALTER COLUMN state_set_id DROP NOT NULL;
ALTER TABLE style_combination_revisions
    ADD CONSTRAINT scr_live_payload_required CHECK (
        deleted OR (
            combination_key IS NOT NULL AND value IS NOT NULL AND position IS NOT NULL AND state_set_id IS NOT NULL
        )
    );
ALTER TABLE style_combination_member_revisions ALTER COLUMN style_id DROP NOT NULL;
ALTER TABLE style_combination_member_revisions
    ADD CONSTRAINT scmr_live_payload_required CHECK (deleted OR style_id IS NOT NULL);
ALTER TABLE component_style_reference_revisions
    ALTER COLUMN target_appearance_id DROP NOT NULL,
    ALTER COLUMN reference DROP NOT NULL;
ALTER TABLE component_style_reference_revisions
    ADD CONSTRAINT csrr_live_payload_required CHECK (
        deleted OR (target_appearance_id IS NOT NULL AND reference IS NOT NULL)
    );
ALTER TABLE component_style_reference_style_revisions ALTER COLUMN style_id DROP NOT NULL;
ALTER TABLE component_style_reference_style_revisions
    ADD CONSTRAINT csrsr_live_payload_required CHECK (deleted OR style_id IS NOT NULL);

CREATE UNIQUE INDEX tenant_revisions_version_name_ci_unique
    ON tenant_revisions (design_system_id, design_system_version_id, lower(name))
    WHERE NOT deleted AND name IS NOT NULL;
CREATE UNIQUE INDEX token_revisions_version_name_unique
    ON token_revisions (design_system_id, design_system_version_id, name)
    WHERE NOT deleted;

-- Время изменения относится к предметной редакции. До удаления изменяемых столбцов
-- переносим исходные метки во все таблицы редакций; новые записи получают время записи.
DO $$
DECLARE
    item text[];
BEGIN
    FOREACH item SLICE 1 IN ARRAY ARRAY[
        ARRAY['design_systems', 'design_system_revisions', 'design_system_id'],
        ARRAY['tenants', 'tenant_revisions', 'tenant_id'],
        ARRAY['tokens', 'token_revisions', 'token_id'],
        ARRAY['token_values', 'token_value_revisions', 'token_value_id'],
        ARRAY['design_system_components', 'design_system_component_revisions', 'design_system_component_id'],
        ARRAY['appearances', 'appearance_revisions', 'appearance_id'],
        ARRAY['styles', 'style_revisions', 'style_id'],
        ARRAY['component_reuse_configs', 'component_reuse_config_revisions', 'component_reuse_config_id'],
        ARRAY['appearance_variations', 'appearance_variation_revisions', 'appearance_variation_id'],
        ARRAY['appearance_variation_values', 'appearance_variation_value_revisions', 'appearance_variation_value_id'],
        ARRAY['appearance_combinations', 'appearance_combination_revisions', 'appearance_combination_id'],
        ARRAY[
            'appearance_combination_members',
            'appearance_combination_member_revisions',
            'appearance_combination_member_id'
        ],
        ARRAY['invariant_property_values', 'invariant_property_value_revisions', 'invariant_property_value_id'],
        ARRAY[
            'invariant_platform_param_adjustments',
            'invariant_platform_param_adjustment_revisions',
            'invariant_platform_param_adjustment_id'
        ],
        ARRAY['variation_property_values', 'variation_property_value_revisions', 'variation_property_value_id'],
        ARRAY[
            'variation_platform_param_adjustments',
            'variation_platform_param_adjustment_revisions',
            'variation_platform_param_adjustment_id'
        ],
        ARRAY['style_combinations', 'style_combination_revisions', 'style_combination_id'],
        ARRAY['style_combination_members', 'style_combination_member_revisions', 'style_combination_member_id'],
        ARRAY['component_style_references', 'component_style_reference_revisions', 'component_style_reference_id'],
        ARRAY[
            'component_style_reference_styles',
            'component_style_reference_style_revisions',
            'component_style_reference_style_id'
        ]
    ] LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN updated_at timestamp NOT NULL DEFAULT now()',
            item[2]
        );
        EXECUTE format(
            'UPDATE %I revision SET updated_at = entity.updated_at FROM %I entity '
                || 'WHERE revision.%I = entity.id',
            item[2], item[1], item[3]
        );
    END LOOP;
END;
$$;

ALTER TABLE design_systems
    DROP COLUMN name CASCADE,
    DROP COLUMN description CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE tenants
    DROP COLUMN name CASCADE,
    DROP COLUMN description CASCADE,
    DROP COLUMN color_config CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE tokens
    DROP COLUMN name CASCADE,
    DROP COLUMN type CASCADE,
    DROP COLUMN display_name CASCADE,
    DROP COLUMN description CASCADE,
    DROP COLUMN enabled CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE token_values
    DROP COLUMN palette_id CASCADE,
    DROP COLUMN value CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE design_system_components
    DROP COLUMN updated_at CASCADE;

ALTER TABLE appearances
    DROP COLUMN name CASCADE,
    DROP COLUMN root_variation_id CASCADE,
    DROP COLUMN color_scheme_variation_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE styles
    DROP COLUMN name CASCADE,
    DROP COLUMN description CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE component_reuse_configs
    DROP COLUMN appearance_id CASCADE,
    DROP COLUMN variation_id CASCADE,
    DROP COLUMN style_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE appearance_variations
    DROP COLUMN position CASCADE,
    DROP COLUMN default_style_id CASCADE,
    DROP COLUMN is_color_scheme CASCADE,
    DROP COLUMN declared_type CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE appearance_variation_values
    DROP COLUMN style_id CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN authored_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE appearance_combinations
    DROP COLUMN combination_key CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN authored_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE appearance_combination_members
    DROP COLUMN style_id CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE invariant_property_values
    DROP COLUMN token_id CASCADE,
    DROP COLUMN value CASCADE,
    DROP COLUMN alpha CASCADE,
    DROP COLUMN adjustment CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN state_set_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE invariant_platform_param_adjustments
    DROP COLUMN value CASCADE,
    DROP COLUMN template CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE variation_property_values
    DROP COLUMN token_id CASCADE,
    DROP COLUMN value CASCADE,
    DROP COLUMN alpha CASCADE,
    DROP COLUMN adjustment CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN state_set_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE variation_platform_param_adjustments
    DROP COLUMN value CASCADE,
    DROP COLUMN template CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE style_combinations
    DROP COLUMN combination_key CASCADE,
    DROP COLUMN value CASCADE,
    DROP COLUMN token_id CASCADE,
    DROP COLUMN alpha CASCADE,
    DROP COLUMN adjustment CASCADE,
    DROP COLUMN position CASCADE,
    DROP COLUMN state_set_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE style_combination_members
    DROP COLUMN style_id CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE component_style_references
    DROP COLUMN invariant_property_value_id CASCADE,
    DROP COLUMN variation_property_value_id CASCADE,
    DROP COLUMN style_combination_id CASCADE,
    DROP COLUMN target_appearance_id CASCADE,
    DROP COLUMN reference CASCADE,
    DROP COLUMN updated_at CASCADE;

ALTER TABLE component_style_reference_styles
    DROP COLUMN style_id CASCADE,
    DROP COLUMN updated_at CASCADE;

-- Конфигурация конкретной дизайн-системы и её история не должны исчезать при очистке
-- общего каталога API компонентов. PostgreSQL явно запрещает такое удаление.
ALTER TABLE design_system_components
    DROP CONSTRAINT design_system_components_component_id_components_id_fk,
    ADD CONSTRAINT design_system_components_component_id_components_id_fk
        FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE RESTRICT;

ALTER TABLE appearances
    DROP CONSTRAINT appearances_component_id_components_id_fk,
    ADD CONSTRAINT appearances_component_id_components_id_fk
        FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE RESTRICT;

ALTER TABLE component_reuse_configs
    DROP CONSTRAINT component_reuse_configs_component_dep_id_component_deps_id_fk,
    ADD CONSTRAINT component_reuse_configs_component_dep_id_component_deps_id_fk
        FOREIGN KEY (component_dep_id) REFERENCES component_deps (id) ON DELETE RESTRICT;

ALTER TABLE invariant_property_values
    DROP CONSTRAINT invariant_property_values_property_id_properties_id_fk,
    DROP CONSTRAINT invariant_property_values_component_id_components_id_fk,
    ADD CONSTRAINT invariant_property_values_property_id_properties_id_fk
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT,
    ADD CONSTRAINT invariant_property_values_component_id_components_id_fk
        FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE RESTRICT;

ALTER TABLE variation_property_values
    DROP CONSTRAINT variation_property_values_property_id_properties_id_fk,
    ADD CONSTRAINT variation_property_values_property_id_properties_id_fk
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT;

ALTER TABLE style_combinations
    DROP CONSTRAINT style_combinations_property_id_properties_id_fk,
    ADD CONSTRAINT style_combinations_property_id_properties_id_fk
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT;

ALTER TABLE styles
    DROP CONSTRAINT styles_variation_id_variations_id_fk,
    ADD CONSTRAINT styles_variation_id_variations_id_fk
        FOREIGN KEY (variation_id) REFERENCES variations (id) ON DELETE RESTRICT;

ALTER TABLE appearance_variations
    DROP CONSTRAINT appearance_variations_variation_id_variations_id_fk,
    ADD CONSTRAINT appearance_variations_variation_id_variations_id_fk
        FOREIGN KEY (variation_id) REFERENCES variations (id) ON DELETE RESTRICT;

ALTER TABLE invariant_platform_param_adjustments
    DROP CONSTRAINT invariant_platform_param_adjustments_platform_param_id_property_platform_params_id_fk,
    ADD CONSTRAINT invariant_platform_param_adjustments_platform_param_id_property_platform_params_id_fk
        FOREIGN KEY (platform_param_id) REFERENCES property_platform_params (id) ON DELETE RESTRICT;

ALTER TABLE variation_platform_param_adjustments
    DROP CONSTRAINT variation_platform_param_adjustments_platform_param_id_property_platform_params_id_fk,
    ADD CONSTRAINT variation_platform_param_adjustments_platform_param_id_property_platform_params_id_fk
        FOREIGN KEY (platform_param_id) REFERENCES property_platform_params (id) ON DELETE RESTRICT;

-- Изменяемые ссылки, перенесённые из устойчивых таблиц, также защищают исторические данные.
ALTER TABLE component_reuse_config_revisions
    ADD CONSTRAINT crcr_variation_fk FOREIGN KEY (variation_id)
        REFERENCES variations (id) ON DELETE RESTRICT;

ALTER TABLE invariant_property_value_revisions
    ADD CONSTRAINT ipvr_state_set_fk FOREIGN KEY (state_set_id)
        REFERENCES state_sets (id) ON DELETE RESTRICT;

ALTER TABLE variation_property_value_revisions
    ADD CONSTRAINT vpvr_state_set_fk FOREIGN KEY (state_set_id)
        REFERENCES state_sets (id) ON DELETE RESTRICT;

ALTER TABLE style_combination_revisions
    ADD CONSTRAINT scr_state_set_fk FOREIGN KEY (state_set_id)
        REFERENCES state_sets (id) ON DELETE RESTRICT;

-- Идентификаторы пользователей и проектных ключей приходят из authorization-core как строки.
ALTER TABLE entity_edit_states
    ALTER COLUMN last_actor_id TYPE text USING last_actor_id::text;

ALTER TABLE entity_edit_paths
    ALTER COLUMN last_actor_id TYPE text USING last_actor_id::text;

ALTER TABLE idempotent_requests
    ALTER COLUMN actor_id TYPE text USING actor_id::text;

-- Любое изменение предметной редакции активного черновика меняет редакцию его границы.
-- Опубликованные и исходные границы после создания неизменяемы.
CREATE OR REPLACE FUNCTION touch_design_system_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    boundary_id uuid;
    boundary_design_system_id uuid;
    boundary_status design_system_version_status;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Revision rows are immutable; replace the active draft revision';
    END IF;

    boundary_id := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.design_system_version_id
        ELSE NEW.design_system_version_id
    END;

    SELECT design_system_id, status INTO boundary_design_system_id, boundary_status
    FROM design_system_versions
    WHERE id = boundary_id
    FOR UPDATE;

    IF TG_OP = 'DELETE' AND boundary_status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Published and baseline revisions are immutable; retry on the active draft';
    END IF;
    IF TG_OP = 'INSERT'
        AND boundary_status IS DISTINCT FROM 'draft'
        AND NOT (
            boundary_status = 'baseline'
            AND NOT EXISTS (
                SELECT 1 FROM design_system_versions
                WHERE design_system_id = boundary_design_system_id
                  AND status = 'draft'
            )
        ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Baseline and published revisions are immutable; write to the active draft';
    END IF;
    IF boundary_status = 'draft' THEN
        UPDATE design_system_versions
        SET revision = revision + 1
        WHERE id = boundary_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Создание первого черновика и первичное заполнение исходной версии используют одну блокировку.
-- Поэтому исходная редакция либо фиксируется до черновика, либо видит уже созданный черновик и отклоняется.
CREATE OR REPLACE FUNCTION enforce_design_system_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    baseline_id uuid;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'A published version must be created by publishing a draft';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IN ('baseline', 'published') THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Baseline and published version boundaries are immutable';
    END IF;

    IF TG_OP = 'UPDATE'
        AND OLD.status = 'draft'
        AND (
            NEW.id IS DISTINCT FROM OLD.id
            OR NEW.design_system_id IS DISTINCT FROM OLD.design_system_id
            OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
            OR NEW.status NOT IN ('draft', 'published')
        ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'A draft may only stay a draft or become published';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS NULL AND NEW.status IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Archived snapshot boundaries cannot enter the versioned lifecycle';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
        SELECT id INTO baseline_id
        FROM design_system_versions
        WHERE design_system_id = NEW.design_system_id
          AND status = 'baseline'
        FOR UPDATE;

        IF baseline_id IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'A draft requires an initialized baseline';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER design_system_versions_enforce_lifecycle
    BEFORE INSERT OR UPDATE ON design_system_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_design_system_version_lifecycle();

DO $$
DECLARE
    revision_table text;
BEGIN
    FOREACH revision_table IN ARRAY ARRAY[
        'design_system_revisions',
        'tenant_revisions',
        'token_revisions',
        'token_value_revisions',
        'design_system_component_revisions',
        'appearance_revisions',
        'style_revisions',
        'component_reuse_config_revisions',
        'appearance_variation_revisions',
        'appearance_variation_value_revisions',
        'appearance_combination_revisions',
        'appearance_combination_member_revisions',
        'invariant_property_value_revisions',
        'invariant_platform_param_adjustment_revisions',
        'variation_property_value_revisions',
        'variation_platform_param_adjustment_revisions',
        'style_combination_revisions',
        'style_combination_member_revisions',
        'component_style_reference_revisions',
        'component_style_reference_style_revisions'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_touch_draft BEFORE INSERT OR UPDATE OR DELETE ON %I '
                || 'FOR EACH ROW EXECUTE FUNCTION touch_design_system_draft_revision()',
            revision_table,
            revision_table
        );
    END LOOP;
END;
$$;

CREATE UNIQUE INDEX dsv_published_version_unique
    ON design_system_versions (design_system_id, version)
    WHERE status = 'published';

-- Техническая редакция принадлежит устойчивой предметной строке, а не всему компоненту
-- или tenant. Автор приходит из доверенного контекста транзакции.
CREATE OR REPLACE FUNCTION track_subject_edit_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    source jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
    boundary_id uuid := (source ->> 'design_system_version_id')::uuid;
    design_system uuid := (source ->> 'design_system_id')::uuid;
    subject_id uuid := (source ->> TG_ARGV[1])::uuid;
    actor text := COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system');
    next_revision bigint;
    changed_path text;
    explicit_paths text := NULLIF(current_setting('ds.changed_paths', true), '');
    base_revision_text text := NULLIF(current_setting('ds.base_revision', true), '');
    conflict_paths text[] := ARRAY[]::text[];
    metadata jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM design_system_versions
        WHERE id = boundary_id AND status = 'draft'
    ) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO entity_edit_states(
        design_system_version_id, design_system_id, entity_type, entity_id,
        revision, last_actor_id, updated_at
    ) VALUES (boundary_id, design_system, TG_ARGV[0], subject_id, 1, actor, now())
    ON CONFLICT (design_system_version_id, entity_type, entity_id)
    DO UPDATE SET revision = entity_edit_states.revision + 1,
                  last_actor_id = EXCLUDED.last_actor_id,
                  updated_at = now()
    RETURNING revision INTO next_revision;

    FOR changed_path IN
        SELECT path
        FROM (
            SELECT unnest(string_to_array(explicit_paths, ',')) AS path
            WHERE explicit_paths IS NOT NULL
            UNION ALL
            SELECT '/' || key AS path
            FROM jsonb_object_keys(
                source - ARRAY[
                    'id', TG_ARGV[1], 'design_system_id', 'design_system_version_id',
                    'version_sequence_number', 'deleted', 'created_at', 'updated_at'
                ]::text[]
            ) AS keys(key)
            WHERE explicit_paths IS NULL
        ) paths
    LOOP
        IF base_revision_text IS NOT NULL AND EXISTS (
            SELECT 1 FROM entity_edit_paths
            WHERE design_system_version_id = boundary_id
              AND entity_type = TG_ARGV[0]
              AND entity_id = subject_id
              AND path = changed_path
              AND last_revision > base_revision_text::bigint
        ) THEN
            conflict_paths := array_append(conflict_paths, changed_path);
        END IF;
        INSERT INTO entity_edit_paths(
            design_system_version_id, design_system_id, entity_type, entity_id,
            path, last_revision, last_actor_id, updated_at
        ) VALUES (boundary_id, design_system, TG_ARGV[0], subject_id,
                  changed_path, next_revision, actor, now())
        ON CONFLICT (design_system_version_id, entity_type, entity_id, path)
        DO UPDATE SET last_revision = EXCLUDED.last_revision,
                      last_actor_id = EXCLUDED.last_actor_id,
                      updated_at = now();
    END LOOP;
    IF base_revision_text IS NOT NULL THEN
        metadata := jsonb_build_object(
            'entityType', TG_ARGV[0],
            'entityId', subject_id,
            'revision', next_revision,
            'warnings', conflict_paths
        );
        PERFORM set_config(
            'ds.mutation_metadata',
            (COALESCE(NULLIF(current_setting('ds.mutation_metadata', true), ''), '[]')::jsonb
                || jsonb_build_array(metadata))::text,
            true
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
    item text[];
BEGIN
    FOREACH item SLICE 1 IN ARRAY ARRAY[
        ARRAY['design_system_revisions', 'design-system', 'design_system_id'],
        ARRAY['tenant_revisions', 'tenant', 'tenant_id'],
        ARRAY['token_revisions', 'token', 'token_id'],
        ARRAY['token_value_revisions', 'token-value', 'token_value_id'],
        ARRAY['design_system_component_revisions', 'design-system-component', 'design_system_component_id'],
        ARRAY['appearance_revisions', 'appearance', 'appearance_id'],
        ARRAY['style_revisions', 'style', 'style_id'],
        ARRAY['component_reuse_config_revisions', 'component-reuse-config', 'component_reuse_config_id'],
        ARRAY['appearance_variation_revisions', 'appearance-variation', 'appearance_variation_id'],
        ARRAY['appearance_variation_value_revisions', 'appearance-variation-value', 'appearance_variation_value_id'],
        ARRAY['appearance_combination_revisions', 'appearance-combination', 'appearance_combination_id'],
        ARRAY[
            'appearance_combination_member_revisions',
            'appearance-combination-member',
            'appearance_combination_member_id'
        ],
        ARRAY['invariant_property_value_revisions', 'invariant-property-value', 'invariant_property_value_id'],
        ARRAY[
            'invariant_platform_param_adjustment_revisions',
            'invariant-platform-param-adjustment',
            'invariant_platform_param_adjustment_id'
        ],
        ARRAY['variation_property_value_revisions', 'variation-property-value', 'variation_property_value_id'],
        ARRAY[
            'variation_platform_param_adjustment_revisions',
            'variation-platform-param-adjustment',
            'variation_platform_param_adjustment_id'
        ],
        ARRAY['style_combination_revisions', 'style-combination', 'style_combination_id'],
        ARRAY['style_combination_member_revisions', 'style-combination-member', 'style_combination_member_id'],
        ARRAY['component_style_reference_revisions', 'component-style-reference', 'component_style_reference_id'],
        ARRAY[
            'component_style_reference_style_revisions',
            'component-style-reference-style',
            'component_style_reference_style_id'
        ]
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_edit_state AFTER INSERT ON %I '
                || 'FOR EACH ROW EXECUTE FUNCTION track_subject_edit_revision(%L, %L)',
            item[1], item[1], item[2], item[3]
        );
    END LOOP;
END;
$$;

-- Черновик хранит только отличие от предыдущей границы. Техническая редакция уже
-- увеличена отдельным триггером и не откатывается при удалении лишней предметной строки.
CREATE OR REPLACE FUNCTION compact_subject_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    previous_row jsonb;
    new_subject jsonb;
    previous_subject jsonb;
    metadata_keys text[] := ARRAY[
        'id', TG_ARGV[2], 'design_system_id', 'design_system_version_id',
        'version_sequence_number', 'deleted', 'created_at', 'updated_at'
    ];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM design_system_versions
        WHERE id = NEW.design_system_version_id AND status = 'draft'
    ) THEN
        RETURN NEW;
    END IF;

    EXECUTE format(
        'SELECT to_jsonb(previous) FROM %I previous '
            || 'WHERE previous.%I = $1 AND previous.version_sequence_number < $2 '
            || 'ORDER BY previous.version_sequence_number DESC LIMIT 1',
        TG_TABLE_NAME,
        TG_ARGV[2]
    ) INTO previous_row USING (to_jsonb(NEW) ->> TG_ARGV[2])::uuid, NEW.version_sequence_number;

    IF NEW.deleted AND previous_row IS NULL THEN
        BEGIN
            EXECUTE format('DELETE FROM %I WHERE id = $1', TG_TABLE_NAME) USING NEW.id;
            EXECUTE format('DELETE FROM %I WHERE id = $1', TG_ARGV[1])
                USING (to_jsonb(NEW) ->> TG_ARGV[2])::uuid;
        EXCEPTION
            WHEN foreign_key_violation THEN
                -- У сущности есть действующие дочерние строки: сохраняем tombstone,
                -- чтобы удаление оставалось явным и обратимым.
                RETURN NEW;
        END;
        RETURN NEW;
    END IF;

    IF NOT NEW.deleted AND previous_row IS NOT NULL AND NOT (previous_row ->> 'deleted')::boolean THEN
        new_subject := to_jsonb(NEW) - metadata_keys;
        previous_subject := previous_row - metadata_keys;
        IF new_subject = previous_subject THEN
            EXECUTE format('DELETE FROM %I WHERE id = $1', TG_TABLE_NAME) USING NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    item text[];
BEGIN
    FOREACH item SLICE 1 IN ARRAY ARRAY[
        ARRAY['design_system_revisions', 'design_systems', 'design_system_id'],
        ARRAY['tenant_revisions', 'tenants', 'tenant_id'],
        ARRAY['token_revisions', 'tokens', 'token_id'],
        ARRAY['token_value_revisions', 'token_values', 'token_value_id'],
        ARRAY['design_system_component_revisions', 'design_system_components', 'design_system_component_id'],
        ARRAY['appearance_revisions', 'appearances', 'appearance_id'],
        ARRAY['style_revisions', 'styles', 'style_id'],
        ARRAY['component_reuse_config_revisions', 'component_reuse_configs', 'component_reuse_config_id'],
        ARRAY['appearance_variation_revisions', 'appearance_variations', 'appearance_variation_id'],
        ARRAY[
            'appearance_variation_value_revisions',
            'appearance_variation_values',
            'appearance_variation_value_id'
        ],
        ARRAY['appearance_combination_revisions', 'appearance_combinations', 'appearance_combination_id'],
        ARRAY[
            'appearance_combination_member_revisions',
            'appearance_combination_members',
            'appearance_combination_member_id'
        ],
        ARRAY['invariant_property_value_revisions', 'invariant_property_values', 'invariant_property_value_id'],
        ARRAY[
            'invariant_platform_param_adjustment_revisions',
            'invariant_platform_param_adjustments',
            'invariant_platform_param_adjustment_id'
        ],
        ARRAY['variation_property_value_revisions', 'variation_property_values', 'variation_property_value_id'],
        ARRAY[
            'variation_platform_param_adjustment_revisions',
            'variation_platform_param_adjustments',
            'variation_platform_param_adjustment_id'
        ],
        ARRAY['style_combination_revisions', 'style_combinations', 'style_combination_id'],
        ARRAY['style_combination_member_revisions', 'style_combination_members', 'style_combination_member_id'],
        ARRAY['component_style_reference_revisions', 'component_style_references', 'component_style_reference_id'],
        ARRAY[
            'component_style_reference_style_revisions',
            'component_style_reference_styles',
            'component_style_reference_style_id'
        ]
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_compact AFTER INSERT ON %I '
                || 'FOR EACH ROW EXECUTE FUNCTION compact_subject_draft_revision(%L, %L, %L)',
            item[1], item[1], item[1], item[2], item[3]
        );
    END LOOP;
END;
$$;

-- Журнал новой модели вычисляется из предметных редакций и не принимает строки от клиента.
DROP TABLE design_system_changes;

-- JSONB normalizes property order and whitespace. The idempotency contract
-- replays the exact response produced by the first request, so the body is
-- stored as opaque JSON text after validation by the presentation layer.
ALTER TABLE idempotent_requests
    ALTER COLUMN response_body TYPE text
    USING response_body::text;

ALTER TABLE tenants DROP COLUMN edit_revision;

-- Область дизайн-системы является первым условием снимков журнала и предметных чтений.
CREATE INDEX IF NOT EXISTS design_systems_project_id_idx ON design_systems (project_id, id);
CREATE INDEX IF NOT EXISTS tenants_design_system_id_idx ON tenants (design_system_id, id);
CREATE INDEX IF NOT EXISTS tokens_design_system_id_idx ON tokens (design_system_id, id);
CREATE INDEX IF NOT EXISTS token_values_design_system_id_idx ON token_values (design_system_id, id);

CREATE INDEX IF NOT EXISTS design_system_components_design_system_id_idx
    ON design_system_components (design_system_id, id);
CREATE INDEX IF NOT EXISTS appearances_design_system_id_idx ON appearances (design_system_id, id);
CREATE INDEX IF NOT EXISTS styles_design_system_id_idx ON styles (design_system_id, id);
CREATE INDEX IF NOT EXISTS component_reuse_configs_design_system_id_idx
    ON component_reuse_configs (design_system_id, id);
CREATE INDEX IF NOT EXISTS appearance_variations_design_system_id_idx
    ON appearance_variations (design_system_id, id);
CREATE INDEX IF NOT EXISTS appearance_variation_values_design_system_id_idx
    ON appearance_variation_values (design_system_id, id);
CREATE INDEX IF NOT EXISTS appearance_combinations_design_system_id_idx
    ON appearance_combinations (design_system_id, id);
CREATE INDEX IF NOT EXISTS appearance_combination_members_design_system_id_idx
    ON appearance_combination_members (design_system_id, id);
CREATE INDEX IF NOT EXISTS invariant_property_values_design_system_id_idx
    ON invariant_property_values (design_system_id, id);
CREATE INDEX IF NOT EXISTS invariant_platform_param_adjustments_design_system_id_idx
    ON invariant_platform_param_adjustments (design_system_id, id);
CREATE INDEX IF NOT EXISTS variation_property_values_design_system_id_idx
    ON variation_property_values (design_system_id, id);
CREATE INDEX IF NOT EXISTS variation_platform_param_adjustments_design_system_id_idx
    ON variation_platform_param_adjustments (design_system_id, id);
CREATE INDEX IF NOT EXISTS style_combinations_design_system_id_idx
    ON style_combinations (design_system_id, id);
CREATE INDEX IF NOT EXISTS style_combination_members_design_system_id_idx
    ON style_combination_members (design_system_id, id);
CREATE INDEX IF NOT EXISTS component_style_references_design_system_id_idx
    ON component_style_references (design_system_id, id);
CREATE INDEX IF NOT EXISTS component_style_reference_styles_design_system_id_idx
    ON component_style_reference_styles (design_system_id, id);

ALTER TABLE idempotent_requests
    ADD CONSTRAINT idempotent_requests_key_length_check
    CHECK (char_length(idempotency_key) BETWEEN 1 AND 255);

-- Переходные триггеры были нужны только пока репозитории не передавали design_system_id явно.
-- После переключения всех записей область проверяют NOT NULL и составные внешние ключи.
DROP TRIGGER IF EXISTS token_values_inherit_design_system ON token_values;
DROP TRIGGER IF EXISTS av_inherit_design_system ON appearance_variations;
DROP TRIGGER IF EXISTS avv_inherit_design_system ON appearance_variation_values;
DROP TRIGGER IF EXISTS ac_inherit_design_system ON appearance_combinations;
DROP TRIGGER IF EXISTS acm_inherit_design_system ON appearance_combination_members;
DROP TRIGGER IF EXISTS ippa_inherit_design_system ON invariant_platform_param_adjustments;
DROP TRIGGER IF EXISTS vpv_inherit_design_system ON variation_property_values;
DROP TRIGGER IF EXISTS vppa_inherit_design_system ON variation_platform_param_adjustments;
DROP TRIGGER IF EXISTS sc_inherit_design_system ON style_combinations;
DROP TRIGGER IF EXISTS scm_inherit_design_system ON style_combination_members;
DROP TRIGGER IF EXISTS csrs_inherit_design_system ON component_style_reference_styles;
DROP FUNCTION IF EXISTS inherit_design_system_from_owner();

-- Предметная запись берёт разделяемую блокировку дизайн-системы и проверяет границу,
-- но не удерживает блокировку строки активного черновика во время всей транзакции.
CREATE OR REPLACE FUNCTION touch_design_system_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    boundary_id uuid;
    boundary_design_system_id uuid;
    boundary_status design_system_version_status;
    deleting_design_system_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.deleting_design_system_ids', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    IF TG_OP = 'DELETE'
        AND pg_trigger_depth() > 1
        AND OLD.design_system_id::text = ANY(deleting_design_system_ids) THEN
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Revision rows are immutable; replace the active draft revision';
    END IF;

    boundary_id := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.design_system_version_id
        ELSE NEW.design_system_version_id
    END;

    SELECT design_system_id, status INTO boundary_design_system_id, boundary_status
    FROM design_system_versions
    WHERE id = boundary_id;

    PERFORM pg_advisory_xact_lock_shared(hashtextextended(boundary_design_system_id::text, 684313));

    -- Публикация могла завершиться между предметным чтением и первой записью редакции.
    -- После получения разделяемой блокировки состояние читается повторно.
    SELECT status INTO boundary_status
    FROM design_system_versions
    WHERE id = boundary_id;

    IF boundary_status = 'baseline' THEN
        PERFORM 1 FROM design_system_versions WHERE id = boundary_id FOR UPDATE;
    END IF;

    IF TG_OP = 'DELETE' AND boundary_status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Published and baseline revisions are immutable; retry on the active draft';
    END IF;
    IF TG_OP = 'INSERT'
        AND boundary_status IS DISTINCT FROM 'draft'
        AND NOT (
            boundary_status = 'baseline'
            AND NOT EXISTS (
                SELECT 1 FROM design_system_versions
                WHERE design_system_id = boundary_design_system_id
                  AND status = 'draft'
            )
        ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Baseline and published revisions are immutable; write to the active draft';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Отложенный триггер выполняется перед фиксацией транзакции. Первая предметная строка
-- увеличивает общую редакцию, остальные строки того же черновика видят отметку в GUC.
CREATE OR REPLACE FUNCTION bump_design_system_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    boundary_id uuid := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.design_system_version_id
        ELSE NEW.design_system_version_id
    END;
    bumped_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.bumped_draft_ids', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    IF boundary_id::text = ANY(bumped_ids) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    UPDATE design_system_versions
    SET revision = revision + 1
    WHERE id = boundary_id AND status = 'draft';
    IF FOUND THEN
        PERFORM set_config(
            'ds.bumped_draft_ids',
            array_to_string(array_append(bumped_ids, boundary_id::text), ','),
            true
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Каскадное удаление временных границ разрешено только как часть удаления дизайн-системы.
CREATE OR REPLACE FUNCTION mark_design_system_boundary_cascade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    deleting_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.deleting_design_system_ids', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    PERFORM set_config(
        'ds.deleting_design_system_ids',
        array_to_string(array_append(deleting_ids, OLD.id::text), ','),
        true
    );
    RETURN OLD;
END;
$$;

CREATE TRIGGER design_systems_mark_boundary_cascade
    BEFORE DELETE ON design_systems
    FOR EACH ROW EXECUTE FUNCTION mark_design_system_boundary_cascade();

DROP TRIGGER design_system_versions_enforce_lifecycle ON design_system_versions;
DROP FUNCTION enforce_design_system_version_lifecycle();

CREATE OR REPLACE FUNCTION enforce_design_system_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    baseline_id uuid;
    deleting_design_system_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.deleting_design_system_ids', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Прямое удаление границы уничтожило бы историю через каскадные внешние ключи.
        -- Каскад при удалении самой дизайн-системы остаётся разрешённым.
        IF pg_trigger_depth() <= 1
            OR NOT OLD.design_system_id::text = ANY(deleting_design_system_ids) THEN
            RAISE EXCEPTION USING
                ERRCODE = '40001',
                MESSAGE = 'Version boundaries are immutable; delete the design system instead';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'A published version must be created by publishing a draft';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IN ('baseline', 'published') THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Baseline and published version boundaries are immutable';
    END IF;

    IF TG_OP = 'UPDATE'
        AND OLD.status = 'draft'
        AND (
            NEW.id IS DISTINCT FROM OLD.id
            OR NEW.design_system_id IS DISTINCT FROM OLD.design_system_id
            OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
            OR NEW.status NOT IN ('draft', 'published')
        ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'A draft may only stay a draft or become published';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS NULL AND NEW.status IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Archived snapshot boundaries cannot enter the versioned lifecycle';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
        SELECT id INTO baseline_id
        FROM design_system_versions
        WHERE design_system_id = NEW.design_system_id
          AND status = 'baseline'
        FOR UPDATE;

        IF baseline_id IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'A draft requires an initialized baseline';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER design_system_versions_enforce_lifecycle
    BEFORE INSERT OR UPDATE OR DELETE ON design_system_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_design_system_version_lifecycle();

DO $$
DECLARE
    revision_table text;
BEGIN
    FOREACH revision_table IN ARRAY ARRAY[
        'design_system_revisions',
        'tenant_revisions',
        'token_revisions',
        'token_value_revisions',
        'design_system_component_revisions',
        'appearance_revisions',
        'style_revisions',
        'component_reuse_config_revisions',
        'appearance_variation_revisions',
        'appearance_variation_value_revisions',
        'appearance_combination_revisions',
        'appearance_combination_member_revisions',
        'invariant_property_value_revisions',
        'invariant_platform_param_adjustment_revisions',
        'variation_property_value_revisions',
        'variation_platform_param_adjustment_revisions',
        'style_combination_revisions',
        'style_combination_member_revisions',
        'component_style_reference_revisions',
        'component_style_reference_style_revisions'
    ] LOOP
        EXECUTE format(
            'CREATE CONSTRAINT TRIGGER %I_bump_draft AFTER INSERT OR DELETE ON %I '
                || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
                || 'EXECUTE FUNCTION bump_design_system_draft_revision()',
            revision_table,
            revision_table
        );
    END LOOP;
END;
$$;

-- Начальные значения темы образуют локальную исходную точку для изменений,
-- выполненных до первой публикации. Это не граница версии дизайн-системы.
CREATE TABLE token_value_creation_baselines (
    design_system_version_id uuid NOT NULL,
    token_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    palette_id uuid,
    value jsonb,
    PRIMARY KEY (design_system_version_id, token_value_id),
    CONSTRAINT token_value_creation_baselines_value_fk
        FOREIGN KEY (token_value_id, design_system_id)
        REFERENCES token_values (id, design_system_id) ON DELETE CASCADE,
    CONSTRAINT token_value_creation_baselines_version_fk
        FOREIGN KEY (design_system_version_id, design_system_id)
        REFERENCES design_system_versions (id, design_system_id) ON DELETE CASCADE,
    CONSTRAINT token_value_creation_baselines_palette_fk
        FOREIGN KEY (palette_id) REFERENCES palette (id) ON DELETE RESTRICT
);

CREATE INDEX token_value_creation_baselines_design_system_idx
    ON token_value_creation_baselines (design_system_id, design_system_version_id);

-- Для уже существующих активных черновиков дальнейшие изменения сравниваются
-- с состоянием на момент применения миграции. Ранее выполненные изменения
-- нельзя надёжно отделить от служебного начального наполнения задним числом.
INSERT INTO token_value_creation_baselines (
    design_system_version_id,
    token_value_id,
    design_system_id,
    palette_id,
    value
)
SELECT
    boundary.id,
    value.id,
    value.design_system_id,
    revision.palette_id,
    revision.value
FROM design_system_versions boundary
JOIN tenant_revisions tenant_revision
  ON tenant_revision.design_system_version_id = boundary.id
 AND tenant_revision.design_system_id = boundary.design_system_id
 AND NOT tenant_revision.deleted
JOIN tenants tenant
  ON tenant.id = tenant_revision.tenant_id
 AND tenant.design_system_id = boundary.design_system_id
JOIN token_values value
  ON value.tenant_id = tenant.id
 AND value.design_system_id = boundary.design_system_id
JOIN token_value_revisions revision
  ON revision.token_value_id = value.id
 AND revision.design_system_version_id = boundary.id
 AND revision.design_system_id = boundary.design_system_id
 AND NOT revision.deleted
WHERE boundary.status = 'draft'
  AND NOT EXISTS (
      SELECT 1
      FROM tenant_revisions earlier
      WHERE earlier.tenant_id = tenant.id
        AND earlier.design_system_id = boundary.design_system_id
        AND earlier.version_sequence_number < boundary.sequence_number
  )
ON CONFLICT DO NOTHING;
