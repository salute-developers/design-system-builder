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
