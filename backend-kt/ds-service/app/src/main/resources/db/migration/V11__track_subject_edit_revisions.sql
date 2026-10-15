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
