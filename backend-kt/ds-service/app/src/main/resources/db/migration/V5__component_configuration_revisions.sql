-- Область дизайн-системы становится явной для всех устойчивых сущностей конфигурации.
-- Она неизменяема и используется составными внешними ключами для защиты от межсистемных ссылок.
ALTER TABLE appearance_variations ADD COLUMN design_system_id uuid;
UPDATE appearance_variations av
SET design_system_id = a.design_system_id
FROM appearances a
WHERE a.id = av.appearance_id;

ALTER TABLE appearance_variation_values ADD COLUMN design_system_id uuid;
UPDATE appearance_variation_values avv
SET design_system_id = av.design_system_id
FROM appearance_variations av
WHERE av.id = avv.appearance_variation_id;

ALTER TABLE appearance_combinations ADD COLUMN design_system_id uuid;
UPDATE appearance_combinations ac
SET design_system_id = a.design_system_id
FROM appearances a
WHERE a.id = ac.appearance_id;

ALTER TABLE appearance_combination_members ADD COLUMN design_system_id uuid;
UPDATE appearance_combination_members acm
SET design_system_id = ac.design_system_id
FROM appearance_combinations ac
WHERE ac.id = acm.appearance_combination_id;

ALTER TABLE invariant_platform_param_adjustments ADD COLUMN design_system_id uuid;
UPDATE invariant_platform_param_adjustments adjustment
SET design_system_id = value.design_system_id
FROM invariant_property_values value
WHERE value.id = adjustment.ipv_id;

ALTER TABLE variation_property_values ADD COLUMN design_system_id uuid;
UPDATE variation_property_values value
SET design_system_id = appearance.design_system_id
FROM appearances appearance
WHERE appearance.id = value.appearance_id;

ALTER TABLE variation_platform_param_adjustments ADD COLUMN design_system_id uuid;
UPDATE variation_platform_param_adjustments adjustment
SET design_system_id = value.design_system_id
FROM variation_property_values value
WHERE value.id = adjustment.vpv_id;

ALTER TABLE style_combinations ADD COLUMN design_system_id uuid;
UPDATE style_combinations combination
SET design_system_id = appearance.design_system_id
FROM appearances appearance
WHERE appearance.id = combination.appearance_id;

ALTER TABLE style_combination_members ADD COLUMN design_system_id uuid;
UPDATE style_combination_members member
SET design_system_id = combination.design_system_id
FROM style_combinations combination
WHERE combination.id = member.combination_id;

ALTER TABLE component_style_reference_styles ADD COLUMN design_system_id uuid;
UPDATE component_style_reference_styles style
SET design_system_id = reference.design_system_id
FROM component_style_references reference
WHERE reference.id = style.reference_id;

-- На время переключения репозиториев старые INSERT не передают новую область явно.
-- База выводит её из неизменяемого владельца; переданное вызывающим кодом значение также заменяется
-- значением владельца, поэтому этот переходный механизм нельзя использовать для межсистемной ссылки.
CREATE FUNCTION inherit_design_system_from_owner() RETURNS trigger AS $$
DECLARE
    owner_id uuid;
    owner_design_system_id uuid;
BEGIN
    owner_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
    EXECUTE format('SELECT design_system_id FROM %I WHERE id = $1', TG_ARGV[0])
        INTO owner_design_system_id
        USING owner_id;
    NEW.design_system_id := owner_design_system_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_values_inherit_design_system
BEFORE INSERT OR UPDATE OF tenant_id ON token_values
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('tenants', 'tenant_id');
CREATE TRIGGER av_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_id ON appearance_variations
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearances', 'appearance_id');
CREATE TRIGGER avv_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_variation_id ON appearance_variation_values
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearance_variations', 'appearance_variation_id');
CREATE TRIGGER ac_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_id ON appearance_combinations
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearances', 'appearance_id');
CREATE TRIGGER acm_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_combination_id ON appearance_combination_members
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearance_combinations', 'appearance_combination_id');
CREATE TRIGGER ippa_inherit_design_system
BEFORE INSERT OR UPDATE OF ipv_id ON invariant_platform_param_adjustments
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('invariant_property_values', 'ipv_id');
CREATE TRIGGER vpv_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_id ON variation_property_values
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearances', 'appearance_id');
CREATE TRIGGER vppa_inherit_design_system
BEFORE INSERT OR UPDATE OF vpv_id ON variation_platform_param_adjustments
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('variation_property_values', 'vpv_id');
CREATE TRIGGER sc_inherit_design_system
BEFORE INSERT OR UPDATE OF appearance_id ON style_combinations
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('appearances', 'appearance_id');
CREATE TRIGGER scm_inherit_design_system
BEFORE INSERT OR UPDATE OF combination_id ON style_combination_members
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('style_combinations', 'combination_id');
CREATE TRIGGER csrs_inherit_design_system
BEFORE INSERT OR UPDATE OF reference_id ON component_style_reference_styles
FOR EACH ROW EXECUTE FUNCTION inherit_design_system_from_owner('component_style_references', 'reference_id');

ALTER TABLE appearance_variations ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE appearance_variation_values ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE appearance_combinations ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE appearance_combination_members ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE invariant_platform_param_adjustments ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE variation_property_values ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE variation_platform_param_adjustments ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE style_combinations ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE style_combination_members ALTER COLUMN design_system_id SET NOT NULL;
ALTER TABLE component_style_reference_styles ALTER COLUMN design_system_id SET NOT NULL;

-- Составные устойчивые ключи нужны и владельцу редакции, и изменяемым ссылкам внутри неё.
ALTER TABLE design_system_components ADD CONSTRAINT dsc_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE appearances ADD CONSTRAINT appearances_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE styles ADD CONSTRAINT styles_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE component_reuse_configs ADD CONSTRAINT crc_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE appearance_variations ADD CONSTRAINT av_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE appearance_variations
    ADD CONSTRAINT av_appearance_variation_ds_unique UNIQUE (appearance_id, variation_id, design_system_id);
ALTER TABLE appearance_variation_values ADD CONSTRAINT avv_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE appearance_combinations ADD CONSTRAINT ac_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE appearance_combination_members ADD CONSTRAINT acm_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE invariant_property_values ADD CONSTRAINT ipv_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE invariant_platform_param_adjustments ADD CONSTRAINT ippa_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE variation_property_values ADD CONSTRAINT vpv_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE variation_platform_param_adjustments ADD CONSTRAINT vppa_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE style_combinations ADD CONSTRAINT sc_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE style_combination_members ADD CONSTRAINT scm_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE component_style_references ADD CONSTRAINT csr_id_ds_unique UNIQUE (id, design_system_id);
ALTER TABLE component_style_reference_styles ADD CONSTRAINT csrs_id_ds_unique UNIQUE (id, design_system_id);

-- Вложенная устойчивая сущность не может получить область, отличную от области владельца.
ALTER TABLE appearance_variations
    ADD CONSTRAINT av_appearance_ds_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id);
ALTER TABLE appearance_variation_values
    ADD CONSTRAINT avv_variation_ds_fk FOREIGN KEY (appearance_variation_id, design_system_id)
        REFERENCES appearance_variations (id, design_system_id);
ALTER TABLE appearance_combinations
    ADD CONSTRAINT ac_appearance_ds_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id);
ALTER TABLE appearance_combination_members
    ADD CONSTRAINT acm_combination_ds_fk FOREIGN KEY (appearance_combination_id, design_system_id)
        REFERENCES appearance_combinations (id, design_system_id);
ALTER TABLE invariant_platform_param_adjustments
    ADD CONSTRAINT ippa_value_ds_fk FOREIGN KEY (ipv_id, design_system_id)
        REFERENCES invariant_property_values (id, design_system_id);
ALTER TABLE variation_property_values
    ADD CONSTRAINT vpv_appearance_ds_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id);
ALTER TABLE variation_platform_param_adjustments
    ADD CONSTRAINT vppa_value_ds_fk FOREIGN KEY (vpv_id, design_system_id)
        REFERENCES variation_property_values (id, design_system_id);
ALTER TABLE style_combinations
    ADD CONSTRAINT sc_appearance_ds_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id);
ALTER TABLE style_combination_members
    ADD CONSTRAINT scm_combination_ds_fk FOREIGN KEY (combination_id, design_system_id)
        REFERENCES style_combinations (id, design_system_id);
ALTER TABLE component_style_reference_styles
    ADD CONSTRAINT csrs_reference_ds_fk FOREIGN KEY (reference_id, design_system_id)
        REFERENCES component_style_references (id, design_system_id);

CREATE TABLE design_system_component_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    design_system_component_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE appearance_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appearance_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text,
    root_variation_id uuid,
    color_scheme_variation_id uuid,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE style_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    style_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text NOT NULL,
    description text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE component_reuse_config_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_reuse_config_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    appearance_id uuid NOT NULL,
    variation_id uuid NOT NULL,
    style_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE appearance_variation_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appearance_variation_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    position integer NOT NULL,
    default_style_id uuid,
    declared_type text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE appearance_variation_value_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appearance_variation_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    style_id uuid NOT NULL,
    position integer NOT NULL,
    authored_id text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE appearance_combination_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appearance_combination_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    combination_key text NOT NULL,
    position integer NOT NULL,
    authored_id text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE appearance_combination_member_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appearance_combination_member_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    style_id uuid NOT NULL,
    position integer NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE invariant_property_value_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invariant_property_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    token_id uuid,
    value text,
    alpha text,
    adjustment text,
    position integer NOT NULL,
    state_set_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE invariant_platform_param_adjustment_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invariant_platform_param_adjustment_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    value text,
    template text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE variation_property_value_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_property_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    token_id uuid,
    value text,
    alpha text,
    adjustment text,
    position integer NOT NULL,
    state_set_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE variation_platform_param_adjustment_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    variation_platform_param_adjustment_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    value text,
    template text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE style_combination_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    style_combination_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    combination_key text NOT NULL,
    value text NOT NULL,
    token_id uuid,
    alpha text,
    adjustment text,
    position integer NOT NULL,
    state_set_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE style_combination_member_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    style_combination_member_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    style_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE component_style_reference_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_style_reference_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    invariant_property_value_id uuid,
    variation_property_value_id uuid,
    style_combination_id uuid,
    target_appearance_id uuid NOT NULL,
    reference text NOT NULL,
    deleted boolean NOT NULL DEFAULT false,
    CONSTRAINT csr_revision_single_source_check CHECK (
        (invariant_property_value_id IS NOT NULL)::integer
        + (variation_property_value_id IS NOT NULL)::integer
        + (style_combination_id IS NOT NULL)::integer = 1
    )
);

CREATE TABLE component_style_reference_style_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_style_reference_style_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    style_id uuid NOT NULL,
    deleted boolean NOT NULL DEFAULT false
);

-- Единообразные ограничения редакций: владелец, граница той же дизайн-системы и одна редакция
-- сущности на границу. Исторические ссылки ведут на устойчивые сущности, а не на их текущие поля.
ALTER TABLE design_system_component_revisions
    ADD CONSTRAINT dscr_entity_fk FOREIGN KEY (design_system_component_id, design_system_id)
        REFERENCES design_system_components (id, design_system_id),
    ADD CONSTRAINT dscr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT dscr_entity_version_unique UNIQUE (design_system_component_id, design_system_version_id);

ALTER TABLE appearance_revisions
    ADD CONSTRAINT ar_entity_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id),
    ADD CONSTRAINT ar_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT ar_root_axis_fk FOREIGN KEY (appearance_id, root_variation_id, design_system_id)
        REFERENCES appearance_variations (appearance_id, variation_id, design_system_id),
    ADD CONSTRAINT ar_color_axis_fk FOREIGN KEY (appearance_id, color_scheme_variation_id, design_system_id)
        REFERENCES appearance_variations (appearance_id, variation_id, design_system_id),
    ADD CONSTRAINT ar_entity_version_unique UNIQUE (appearance_id, design_system_version_id);

ALTER TABLE style_revisions
    ADD CONSTRAINT sr_entity_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT sr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT sr_entity_version_unique UNIQUE (style_id, design_system_version_id);

ALTER TABLE component_reuse_config_revisions
    ADD CONSTRAINT crcr_entity_fk FOREIGN KEY (component_reuse_config_id, design_system_id)
        REFERENCES component_reuse_configs (id, design_system_id),
    ADD CONSTRAINT crcr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT crcr_appearance_fk FOREIGN KEY (appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id),
    ADD CONSTRAINT crcr_style_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT crcr_entity_version_unique UNIQUE (component_reuse_config_id, design_system_version_id);

ALTER TABLE appearance_variation_revisions
    ADD CONSTRAINT avr_entity_fk FOREIGN KEY (appearance_variation_id, design_system_id)
        REFERENCES appearance_variations (id, design_system_id),
    ADD CONSTRAINT avr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT avr_default_style_fk FOREIGN KEY (default_style_id, design_system_id)
        REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT avr_entity_version_unique UNIQUE (appearance_variation_id, design_system_version_id);

ALTER TABLE appearance_variation_value_revisions
    ADD CONSTRAINT avvr_entity_fk FOREIGN KEY (appearance_variation_value_id, design_system_id)
        REFERENCES appearance_variation_values (id, design_system_id),
    ADD CONSTRAINT avvr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT avvr_style_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT avvr_entity_version_unique UNIQUE (appearance_variation_value_id, design_system_version_id);

ALTER TABLE appearance_combination_revisions
    ADD CONSTRAINT acr_entity_fk FOREIGN KEY (appearance_combination_id, design_system_id)
        REFERENCES appearance_combinations (id, design_system_id),
    ADD CONSTRAINT acr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT acr_entity_version_unique UNIQUE (appearance_combination_id, design_system_version_id);

ALTER TABLE appearance_combination_member_revisions
    ADD CONSTRAINT acmr_entity_fk FOREIGN KEY (appearance_combination_member_id, design_system_id)
        REFERENCES appearance_combination_members (id, design_system_id),
    ADD CONSTRAINT acmr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT acmr_style_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT acmr_entity_version_unique UNIQUE (appearance_combination_member_id, design_system_version_id);

ALTER TABLE invariant_property_value_revisions
    ADD CONSTRAINT ipvr_entity_fk FOREIGN KEY (invariant_property_value_id, design_system_id)
        REFERENCES invariant_property_values (id, design_system_id),
    ADD CONSTRAINT ipvr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT ipvr_token_fk FOREIGN KEY (token_id, design_system_id) REFERENCES tokens (id, design_system_id),
    ADD CONSTRAINT ipvr_entity_version_unique UNIQUE (invariant_property_value_id, design_system_version_id);

ALTER TABLE invariant_platform_param_adjustment_revisions
    ADD CONSTRAINT ippar_entity_fk FOREIGN KEY (invariant_platform_param_adjustment_id, design_system_id)
        REFERENCES invariant_platform_param_adjustments (id, design_system_id),
    ADD CONSTRAINT ippar_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT ippar_entity_version_unique
        UNIQUE (invariant_platform_param_adjustment_id, design_system_version_id);

ALTER TABLE variation_property_value_revisions
    ADD CONSTRAINT vpvr_entity_fk FOREIGN KEY (variation_property_value_id, design_system_id)
        REFERENCES variation_property_values (id, design_system_id),
    ADD CONSTRAINT vpvr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT vpvr_token_fk FOREIGN KEY (token_id, design_system_id) REFERENCES tokens (id, design_system_id),
    ADD CONSTRAINT vpvr_entity_version_unique UNIQUE (variation_property_value_id, design_system_version_id);

ALTER TABLE variation_platform_param_adjustment_revisions
    ADD CONSTRAINT vppar_entity_fk FOREIGN KEY (variation_platform_param_adjustment_id, design_system_id)
        REFERENCES variation_platform_param_adjustments (id, design_system_id),
    ADD CONSTRAINT vppar_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT vppar_entity_version_unique
        UNIQUE (variation_platform_param_adjustment_id, design_system_version_id);

ALTER TABLE style_combination_revisions
    ADD CONSTRAINT scr_entity_fk FOREIGN KEY (style_combination_id, design_system_id)
        REFERENCES style_combinations (id, design_system_id),
    ADD CONSTRAINT scr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT scr_token_fk FOREIGN KEY (token_id, design_system_id) REFERENCES tokens (id, design_system_id),
    ADD CONSTRAINT scr_entity_version_unique UNIQUE (style_combination_id, design_system_version_id);

ALTER TABLE style_combination_member_revisions
    ADD CONSTRAINT scmr_entity_fk FOREIGN KEY (style_combination_member_id, design_system_id)
        REFERENCES style_combination_members (id, design_system_id),
    ADD CONSTRAINT scmr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT scmr_style_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT scmr_entity_version_unique UNIQUE (style_combination_member_id, design_system_version_id);

ALTER TABLE component_style_reference_revisions
    ADD CONSTRAINT csrr_entity_fk FOREIGN KEY (component_style_reference_id, design_system_id)
        REFERENCES component_style_references (id, design_system_id),
    ADD CONSTRAINT csrr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT csrr_invariant_value_fk FOREIGN KEY (invariant_property_value_id, design_system_id)
        REFERENCES invariant_property_values (id, design_system_id),
    ADD CONSTRAINT csrr_variation_value_fk FOREIGN KEY (variation_property_value_id, design_system_id)
        REFERENCES variation_property_values (id, design_system_id),
    ADD CONSTRAINT csrr_combination_fk FOREIGN KEY (style_combination_id, design_system_id)
        REFERENCES style_combinations (id, design_system_id),
    ADD CONSTRAINT csrr_target_appearance_fk FOREIGN KEY (target_appearance_id, design_system_id)
        REFERENCES appearances (id, design_system_id),
    ADD CONSTRAINT csrr_entity_version_unique UNIQUE (component_style_reference_id, design_system_version_id);

ALTER TABLE component_style_reference_style_revisions
    ADD CONSTRAINT csrsr_entity_fk FOREIGN KEY (component_style_reference_style_id, design_system_id)
        REFERENCES component_style_reference_styles (id, design_system_id),
    ADD CONSTRAINT csrsr_version_fk FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT csrsr_style_fk FOREIGN KEY (style_id, design_system_id) REFERENCES styles (id, design_system_id),
    ADD CONSTRAINT csrsr_entity_version_unique
        UNIQUE (component_style_reference_style_id, design_system_version_id);

CREATE INDEX dscr_boundary_idx
    ON design_system_component_revisions (design_system_component_id, version_sequence_number DESC);
CREATE INDEX ar_boundary_idx ON appearance_revisions (appearance_id, version_sequence_number DESC);
CREATE INDEX sr_boundary_idx ON style_revisions (style_id, version_sequence_number DESC);
CREATE INDEX crcr_boundary_idx
    ON component_reuse_config_revisions (component_reuse_config_id, version_sequence_number DESC);
CREATE INDEX avr_boundary_idx
    ON appearance_variation_revisions (appearance_variation_id, version_sequence_number DESC);
CREATE INDEX avvr_boundary_idx
    ON appearance_variation_value_revisions (appearance_variation_value_id, version_sequence_number DESC);
CREATE INDEX acr_boundary_idx
    ON appearance_combination_revisions (appearance_combination_id, version_sequence_number DESC);
CREATE INDEX acmr_boundary_idx
    ON appearance_combination_member_revisions (appearance_combination_member_id, version_sequence_number DESC);
CREATE INDEX ipvr_boundary_idx
    ON invariant_property_value_revisions (invariant_property_value_id, version_sequence_number DESC);
CREATE INDEX ippar_boundary_idx
    ON invariant_platform_param_adjustment_revisions
        (invariant_platform_param_adjustment_id, version_sequence_number DESC);
CREATE INDEX vpvr_boundary_idx
    ON variation_property_value_revisions (variation_property_value_id, version_sequence_number DESC);
CREATE INDEX vppar_boundary_idx
    ON variation_platform_param_adjustment_revisions
        (variation_platform_param_adjustment_id, version_sequence_number DESC);
CREATE INDEX scr_boundary_idx
    ON style_combination_revisions (style_combination_id, version_sequence_number DESC);
CREATE INDEX scmr_boundary_idx
    ON style_combination_member_revisions (style_combination_member_id, version_sequence_number DESC);
CREATE INDEX csrr_boundary_idx
    ON component_style_reference_revisions (component_style_reference_id, version_sequence_number DESC);
CREATE INDEX csrsr_boundary_idx
    ON component_style_reference_style_revisions
        (component_style_reference_style_id, version_sequence_number DESC);

-- Выбор всех изменений границы используется журналом и публикацией.
CREATE INDEX dscr_version_idx ON design_system_component_revisions (design_system_version_id);
CREATE INDEX ar_version_idx ON appearance_revisions (design_system_version_id);
CREATE INDEX sr_version_idx ON style_revisions (design_system_version_id);
CREATE INDEX crcr_version_idx ON component_reuse_config_revisions (design_system_version_id);
CREATE INDEX avr_version_idx ON appearance_variation_revisions (design_system_version_id);
CREATE INDEX avvr_version_idx ON appearance_variation_value_revisions (design_system_version_id);
CREATE INDEX acr_version_idx ON appearance_combination_revisions (design_system_version_id);
CREATE INDEX acmr_version_idx ON appearance_combination_member_revisions (design_system_version_id);
CREATE INDEX ipvr_version_idx ON invariant_property_value_revisions (design_system_version_id);
CREATE INDEX ippar_version_idx ON invariant_platform_param_adjustment_revisions (design_system_version_id);
CREATE INDEX vpvr_version_idx ON variation_property_value_revisions (design_system_version_id);
CREATE INDEX vppar_version_idx ON variation_platform_param_adjustment_revisions (design_system_version_id);
CREATE INDEX scr_version_idx ON style_combination_revisions (design_system_version_id);
CREATE INDEX scmr_version_idx ON style_combination_member_revisions (design_system_version_id);
CREATE INDEX csrr_version_idx ON component_style_reference_revisions (design_system_version_id);
CREATE INDEX csrsr_version_idx ON component_style_reference_style_revisions (design_system_version_id);
