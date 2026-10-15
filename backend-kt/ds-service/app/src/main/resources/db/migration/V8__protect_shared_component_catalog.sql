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
