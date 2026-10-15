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
