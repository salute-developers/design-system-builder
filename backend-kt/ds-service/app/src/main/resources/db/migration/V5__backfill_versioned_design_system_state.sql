-- Этап 2: перенос существующего состояния в исходные редакции и создание активного черновика.

-- Каждая существующая дизайн-система получает независимую исходную границу и активный черновик.
-- Архивные строки со snapshot не участвуют в этой временной шкале.
INSERT INTO design_system_versions (
    design_system_id,
    version,
    snapshot,
    changelog,
    publication_status,
    published_at,
    status,
    sequence_number,
    revision
)
SELECT id, NULL, NULL, NULL, NULL, NULL, 'baseline', 0, 0
FROM design_systems;

INSERT INTO design_system_revisions (
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    name,
    description
)
SELECT ds.id, boundary.id, boundary.sequence_number, ds.name, ds.description
FROM design_systems ds
JOIN design_system_versions boundary
    ON boundary.design_system_id = ds.id AND boundary.status = 'baseline';

INSERT INTO tenant_revisions (
    tenant_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    name,
    description,
    color_config
)
SELECT tenant.id, tenant.design_system_id, boundary.id, boundary.sequence_number,
       tenant.name, tenant.description, tenant.color_config
FROM tenants tenant
JOIN design_system_versions boundary
    ON boundary.design_system_id = tenant.design_system_id AND boundary.status = 'baseline';

INSERT INTO token_revisions (
    token_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    name,
    type,
    display_name,
    description,
    enabled
)
SELECT token.id, token.design_system_id, boundary.id, boundary.sequence_number,
       token.name, token.type, token.display_name, token.description, token.enabled
FROM tokens token
JOIN design_system_versions boundary
    ON boundary.design_system_id = token.design_system_id AND boundary.status = 'baseline';

INSERT INTO token_value_revisions (
    token_value_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    palette_id,
    value
)
SELECT token_value.id, token_value.design_system_id, boundary.id, boundary.sequence_number,
       token_value.palette_id, token_value.value
FROM token_values token_value
JOIN design_system_versions boundary
    ON boundary.design_system_id = token_value.design_system_id AND boundary.status = 'baseline';

INSERT INTO design_system_component_revisions (
    design_system_component_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number
FROM design_system_components entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO appearance_revisions (
    appearance_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    name,
    root_variation_id,
    color_scheme_variation_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.name, entity.root_variation_id, entity.color_scheme_variation_id
FROM appearances entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO style_revisions (
    style_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    name,
    description
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.name, entity.description
FROM styles entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO component_reuse_config_revisions (
    component_reuse_config_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    appearance_id,
    variation_id,
    style_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.appearance_id, entity.variation_id, entity.style_id
FROM component_reuse_configs entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO appearance_variation_revisions (
    appearance_variation_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    position,
    default_style_id,
    declared_type
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.position, entity.default_style_id, entity.declared_type
FROM appearance_variations entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO appearance_variation_value_revisions (
    appearance_variation_value_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    style_id,
    position,
    authored_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.style_id, entity.position, entity.authored_id
FROM appearance_variation_values entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO appearance_combination_revisions (
    appearance_combination_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    combination_key,
    position,
    authored_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.combination_key, entity.position, entity.authored_id
FROM appearance_combinations entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO appearance_combination_member_revisions (
    appearance_combination_member_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    style_id,
    position
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.style_id, entity.position
FROM appearance_combination_members entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO invariant_property_value_revisions (
    invariant_property_value_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    token_id,
    value,
    alpha,
    adjustment,
    position,
    state_set_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.token_id, entity.value, entity.alpha, entity.adjustment, entity.position, entity.state_set_id
FROM invariant_property_values entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO invariant_platform_param_adjustment_revisions (
    invariant_platform_param_adjustment_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    value,
    template
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.value, entity.template
FROM invariant_platform_param_adjustments entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO variation_property_value_revisions (
    variation_property_value_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    token_id,
    value,
    alpha,
    adjustment,
    position,
    state_set_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.token_id, entity.value, entity.alpha, entity.adjustment, entity.position, entity.state_set_id
FROM variation_property_values entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO variation_platform_param_adjustment_revisions (
    variation_platform_param_adjustment_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    value,
    template
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.value, entity.template
FROM variation_platform_param_adjustments entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO style_combination_revisions (
    style_combination_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    combination_key,
    value,
    token_id,
    alpha,
    adjustment,
    position,
    state_set_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.combination_key, entity.value, entity.token_id, entity.alpha, entity.adjustment,
       entity.position, entity.state_set_id
FROM style_combinations entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO style_combination_member_revisions (
    style_combination_member_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    style_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number, entity.style_id
FROM style_combination_members entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO component_style_reference_revisions (
    component_style_reference_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    invariant_property_value_id,
    variation_property_value_id,
    style_combination_id,
    target_appearance_id,
    reference
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number,
       entity.invariant_property_value_id, entity.variation_property_value_id, entity.style_combination_id,
       entity.target_appearance_id, entity.reference
FROM component_style_references entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

INSERT INTO component_style_reference_style_revisions (
    component_style_reference_style_id,
    design_system_id,
    design_system_version_id,
    version_sequence_number,
    style_id
)
SELECT entity.id, entity.design_system_id, boundary.id, boundary.sequence_number, entity.style_id
FROM component_style_reference_styles entity
JOIN design_system_versions boundary
    ON boundary.design_system_id = entity.design_system_id AND boundary.status = 'baseline';

-- Миграция останавливается, если хотя бы одна текущая строка не получила исходную редакцию.
DO $$
DECLARE
    mismatch text;
BEGIN
    SELECT string_agg(check_name, ', ' ORDER BY check_name)
    INTO mismatch
    FROM (
        SELECT 'design_systems' AS check_name
        WHERE (SELECT count(*) FROM design_systems) <> (SELECT count(*) FROM design_system_revisions)
        UNION ALL SELECT 'tenants'
        WHERE (SELECT count(*) FROM tenants) <> (SELECT count(*) FROM tenant_revisions)
        UNION ALL SELECT 'tokens'
        WHERE (SELECT count(*) FROM tokens) <> (SELECT count(*) FROM token_revisions)
        UNION ALL SELECT 'token_values'
        WHERE (SELECT count(*) FROM token_values) <> (SELECT count(*) FROM token_value_revisions)
        UNION ALL SELECT 'design_system_components'
        WHERE (SELECT count(*) FROM design_system_components) <>
              (SELECT count(*) FROM design_system_component_revisions)
        UNION ALL SELECT 'appearances'
        WHERE (SELECT count(*) FROM appearances) <> (SELECT count(*) FROM appearance_revisions)
        UNION ALL SELECT 'styles'
        WHERE (SELECT count(*) FROM styles) <> (SELECT count(*) FROM style_revisions)
        UNION ALL SELECT 'component_reuse_configs'
        WHERE (SELECT count(*) FROM component_reuse_configs) <>
              (SELECT count(*) FROM component_reuse_config_revisions)
        UNION ALL SELECT 'appearance_variations'
        WHERE (SELECT count(*) FROM appearance_variations) <>
              (SELECT count(*) FROM appearance_variation_revisions)
        UNION ALL SELECT 'appearance_variation_values'
        WHERE (SELECT count(*) FROM appearance_variation_values) <>
              (SELECT count(*) FROM appearance_variation_value_revisions)
        UNION ALL SELECT 'appearance_combinations'
        WHERE (SELECT count(*) FROM appearance_combinations) <>
              (SELECT count(*) FROM appearance_combination_revisions)
        UNION ALL SELECT 'appearance_combination_members'
        WHERE (SELECT count(*) FROM appearance_combination_members) <>
              (SELECT count(*) FROM appearance_combination_member_revisions)
        UNION ALL SELECT 'invariant_property_values'
        WHERE (SELECT count(*) FROM invariant_property_values) <>
              (SELECT count(*) FROM invariant_property_value_revisions)
        UNION ALL SELECT 'invariant_platform_param_adjustments'
        WHERE (SELECT count(*) FROM invariant_platform_param_adjustments) <>
              (SELECT count(*) FROM invariant_platform_param_adjustment_revisions)
        UNION ALL SELECT 'variation_property_values'
        WHERE (SELECT count(*) FROM variation_property_values) <>
              (SELECT count(*) FROM variation_property_value_revisions)
        UNION ALL SELECT 'variation_platform_param_adjustments'
        WHERE (SELECT count(*) FROM variation_platform_param_adjustments) <>
              (SELECT count(*) FROM variation_platform_param_adjustment_revisions)
        UNION ALL SELECT 'style_combinations'
        WHERE (SELECT count(*) FROM style_combinations) <> (SELECT count(*) FROM style_combination_revisions)
        UNION ALL SELECT 'style_combination_members'
        WHERE (SELECT count(*) FROM style_combination_members) <>
              (SELECT count(*) FROM style_combination_member_revisions)
        UNION ALL SELECT 'component_style_references'
        WHERE (SELECT count(*) FROM component_style_references) <>
              (SELECT count(*) FROM component_style_reference_revisions)
        UNION ALL SELECT 'component_style_reference_styles'
        WHERE (SELECT count(*) FROM component_style_reference_styles) <>
              (SELECT count(*) FROM component_style_reference_style_revisions)
    ) failed_checks;

    IF mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'Versioned state backfill count mismatch: %', mismatch;
    END IF;
END;
$$;

INSERT INTO design_system_versions (
    design_system_id,
    version,
    snapshot,
    changelog,
    publication_status,
    published_at,
    status,
    sequence_number,
    revision
)
SELECT id, NULL, NULL, NULL, NULL, NULL, 'draft', 1, 0
FROM design_systems;
