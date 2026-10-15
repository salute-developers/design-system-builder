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
