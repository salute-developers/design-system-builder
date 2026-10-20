-- Версии ДС, предметные редакции, журнал, SSE и палитра: единый атомарный переход с dev V6.
-- V1–V6 уже выпущены и неизменны. Переход не сбрасывает данные и не исправляет историю Flyway.

-- Этап 1: V7__prepare_versioned_design_system_state.sql
-- Этап 1: подготовка итоговой схемы версий и предметных редакций.
-- Миграция добавляет новые структуры, не удаляя перенесённые предметные поля.

-- Независимые временные границы дизайн-системы. Существующие строки со snapshot остаются
-- архивными: у них нет status, sequence_number и revision. Новые границы не содержат snapshot.
CREATE TYPE design_system_version_status AS ENUM ('baseline', 'draft', 'published');

ALTER TABLE design_system_versions
    ALTER COLUMN version DROP NOT NULL,
    ALTER COLUMN snapshot DROP NOT NULL,
    ALTER COLUMN published_at DROP NOT NULL,
    ADD COLUMN status design_system_version_status,
    ADD COLUMN sequence_number bigint,
    ADD COLUMN revision bigint,
    ADD COLUMN created_at timestamp NOT NULL DEFAULT now();

ALTER TABLE design_system_versions
    ADD CONSTRAINT dsv_boundary_shape_check CHECK (
        (
            status IS NULL
            AND sequence_number IS NULL
            AND revision IS NULL
            AND snapshot IS NOT NULL
        )
        OR (
            status = 'baseline'
            AND sequence_number = 0
            AND revision = 0
            AND version IS NULL
            AND snapshot IS NULL
            AND publication_status IS NULL
            AND published_at IS NULL
        )
        OR (
            status = 'draft'
            AND sequence_number > 0
            AND revision >= 0
            AND version IS NULL
            AND snapshot IS NULL
            AND publication_status IS NULL
            AND published_at IS NULL
        )
        OR (
            status = 'published'
            AND sequence_number > 0
            AND revision >= 0
            AND version IS NOT NULL
            AND snapshot IS NULL
            AND publication_status IS NULL
            AND published_at IS NOT NULL
        )
    );

CREATE UNIQUE INDEX dsv_design_system_sequence_unique
    ON design_system_versions (design_system_id, sequence_number)
    WHERE sequence_number IS NOT NULL;

CREATE UNIQUE INDEX dsv_single_baseline_unique
    ON design_system_versions (design_system_id)
    WHERE status = 'baseline';

CREATE UNIQUE INDEX dsv_single_draft_unique
    ON design_system_versions (design_system_id)
    WHERE status = 'draft';

CREATE INDEX dsv_design_system_status_idx
    ON design_system_versions (design_system_id, status)
    WHERE status IS NOT NULL;

-- Устойчивые сущности ядра, тем и токенов. Изменяемые значения будут перенесены в
-- редакции BASELINE ниже в этой миграции после создания всех таблиц редакций.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM tokens WHERE design_system_id IS NULL) THEN
        RAISE EXCEPTION 'Versioning migration stopped: tokens without design_system_id exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM token_values tv
        LEFT JOIN tokens t ON t.id = tv.token_id
        LEFT JOIN tenants tenant ON tenant.id = tv.tenant_id
        WHERE t.id IS NULL
           OR tenant.id IS NULL
           OR t.design_system_id IS DISTINCT FROM tenant.design_system_id
    ) THEN
        RAISE EXCEPTION 'Versioning migration stopped: orphan or cross-design-system token values exist';
    END IF;
END;
$$;

ALTER TABLE tokens
    ALTER COLUMN design_system_id SET NOT NULL;

ALTER TABLE token_values
    ADD COLUMN design_system_id uuid;

UPDATE token_values tv
SET design_system_id = tenant.design_system_id
FROM tenants tenant
WHERE tenant.id = tv.tenant_id;

ALTER TABLE token_values
    ALTER COLUMN design_system_id SET NOT NULL,
    ALTER COLUMN token_id SET NOT NULL,
    ALTER COLUMN tenant_id SET NOT NULL;

CREATE TABLE design_system_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text NOT NULL,
    description text,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE tenant_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text,
    description text,
    color_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE token_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    name text NOT NULL,
    type token_type,
    display_name text,
    description text,
    enabled boolean NOT NULL DEFAULT true,
    deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE token_value_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    palette_id uuid,
    value jsonb,
    deleted boolean NOT NULL DEFAULT false
);

-- Составные ключи не позволяют связать устойчивую сущность и версию разных дизайн-систем.
ALTER TABLE design_system_versions
    ADD CONSTRAINT dsv_id_sequence_design_system_unique
        UNIQUE (id, sequence_number, design_system_id),
    ADD CONSTRAINT dsv_id_design_system_unique
        UNIQUE (id, design_system_id);

ALTER TABLE tenants
    ADD CONSTRAINT tenants_id_design_system_unique UNIQUE (id, design_system_id);

ALTER TABLE tokens
    ADD CONSTRAINT tokens_id_design_system_unique UNIQUE (id, design_system_id);

ALTER TABLE token_values
    ADD CONSTRAINT token_values_id_design_system_unique UNIQUE (id, design_system_id),
    ADD CONSTRAINT token_values_token_design_system_fk
        FOREIGN KEY (token_id, design_system_id)
        REFERENCES tokens (id, design_system_id),
    ADD CONSTRAINT token_values_tenant_design_system_fk
        FOREIGN KEY (tenant_id, design_system_id)
        REFERENCES tenants (id, design_system_id);

ALTER TABLE design_system_revisions
    ADD CONSTRAINT design_system_revisions_design_system_fk
        FOREIGN KEY (design_system_id) REFERENCES design_systems (id) ON DELETE CASCADE,
    ADD CONSTRAINT design_system_revisions_version_fk
        FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT design_system_revisions_entity_version_unique
        UNIQUE (design_system_id, design_system_version_id);

ALTER TABLE tenant_revisions
    ADD CONSTRAINT tenant_revisions_tenant_fk
        FOREIGN KEY (tenant_id, design_system_id) REFERENCES tenants (id, design_system_id),
    ADD CONSTRAINT tenant_revisions_version_fk
        FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT tenant_revisions_entity_version_unique
        UNIQUE (tenant_id, design_system_version_id);

ALTER TABLE token_revisions
    ADD CONSTRAINT token_revisions_token_fk
        FOREIGN KEY (token_id, design_system_id) REFERENCES tokens (id, design_system_id),
    ADD CONSTRAINT token_revisions_version_fk
        FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT token_revisions_entity_version_unique
        UNIQUE (token_id, design_system_version_id);

ALTER TABLE token_value_revisions
    ADD CONSTRAINT token_value_revisions_token_value_fk
        FOREIGN KEY (token_value_id, design_system_id) REFERENCES token_values (id, design_system_id),
    ADD CONSTRAINT token_value_revisions_version_fk
        FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id)
        REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT token_value_revisions_palette_fk
        FOREIGN KEY (palette_id) REFERENCES palette (id) ON DELETE RESTRICT,
    ADD CONSTRAINT token_value_revisions_entity_version_unique
        UNIQUE (token_value_id, design_system_version_id);

CREATE INDEX design_system_revisions_boundary_idx
    ON design_system_revisions (design_system_id, version_sequence_number DESC);
CREATE INDEX design_system_revisions_version_idx
    ON design_system_revisions (design_system_version_id);
CREATE INDEX tenant_revisions_boundary_idx
    ON tenant_revisions (tenant_id, version_sequence_number DESC);
CREATE INDEX tenant_revisions_version_idx
    ON tenant_revisions (design_system_version_id);
CREATE INDEX token_revisions_boundary_idx
    ON token_revisions (token_id, version_sequence_number DESC);
CREATE INDEX token_revisions_version_idx
    ON token_revisions (design_system_version_id);
CREATE INDEX token_value_revisions_boundary_idx
    ON token_value_revisions (token_value_id, version_sequence_number DESC);
CREATE INDEX token_value_revisions_version_idx
    ON token_value_revisions (design_system_version_id);

-- Техническое состояние редактирования не содержит предметных значений и не является журналом.
CREATE TABLE entity_edit_states (
    design_system_version_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    revision bigint NOT NULL DEFAULT 0,
    last_actor_id uuid NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (design_system_version_id, entity_type, entity_id),
    CONSTRAINT entity_edit_states_version_fk
        FOREIGN KEY (design_system_version_id, design_system_id)
        REFERENCES design_system_versions (id, design_system_id)
        ON DELETE CASCADE,
    CONSTRAINT entity_edit_states_revision_non_negative CHECK (revision >= 0)
);

CREATE TABLE entity_edit_paths (
    design_system_version_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    path text NOT NULL,
    last_revision bigint NOT NULL,
    last_actor_id uuid NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (design_system_version_id, entity_type, entity_id, path),
    CONSTRAINT entity_edit_paths_state_fk
        FOREIGN KEY (design_system_version_id, entity_type, entity_id)
        REFERENCES entity_edit_states (design_system_version_id, entity_type, entity_id)
        ON DELETE CASCADE,
    CONSTRAINT entity_edit_paths_revision_positive CHECK (last_revision > 0)
);

CREATE INDEX entity_edit_states_design_system_idx
    ON entity_edit_states (design_system_id, design_system_version_id);
CREATE INDEX entity_edit_paths_entity_idx
    ON entity_edit_paths (design_system_version_id, entity_type, entity_id);

-- Результат небезопасного запроса хранится в области проекта. project_id намеренно не имеет
-- межсервисного внешнего ключа и записи не удаляются каскадом.
CREATE TABLE idempotent_requests (
    project_id text NOT NULL,
    idempotency_key text NOT NULL,
    actor_id uuid NOT NULL,
    operation text NOT NULL,
    request_hash text NOT NULL,
    response_status integer NOT NULL,
    response_body jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, idempotency_key),
    CONSTRAINT idempotent_requests_status_check
        CHECK (response_status BETWEEN 100 AND 599)
);

CREATE INDEX idempotent_requests_created_at_idx ON idempotent_requests (created_at);

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

-- Этап 2: V8__backfill_versioned_design_system_state.sql
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

-- Этап 3: V9__finalize_versioned_design_system_state.sql
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

-- Проверяем отложенные ограничения переноса до следующих изменений структуры.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

-- Этап 4: V10__enable_draft_invalidation_notifications.sql
-- Этап 4: уведомления об изменении активного черновика для SSE.

-- Одно компактное уведомление создаётся для каждой изменённой границы черновика.
-- PostgreSQL доставляет NOTIFY только после успешной фиксации транзакции.
CREATE OR REPLACE FUNCTION bump_design_system_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    boundary_id uuid := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.design_system_version_id
        ELSE NEW.design_system_version_id
    END;
    boundary_design_system_id uuid;
    next_revision bigint;
    bumped_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.bumped_draft_ids', true), ''), ','),
        ARRAY[]::text[]
    );
    actor text := COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system');
    client_id text := NULLIF(current_setting('ds.client_id', true), '');
BEGIN
    IF boundary_id::text = ANY(bumped_ids) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE design_system_versions
    SET revision = revision + 1
    WHERE id = boundary_id AND status = 'draft'
    RETURNING design_system_id, revision INTO boundary_design_system_id, next_revision;

    IF FOUND THEN
        PERFORM set_config(
            'ds.bumped_draft_ids',
            array_to_string(array_append(bumped_ids, boundary_id::text), ','),
            true
        );
        PERFORM pg_notify(
            'ds_draft_invalidations',
            json_build_object(
                'designSystemId', boundary_design_system_id,
                'draftId', boundary_id,
                'draftRevision', next_revision,
                'actorId', actor,
                'clientId', client_id,
                'changedAt', CURRENT_TIMESTAMP
            )::text
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE FUNCTION notify_new_design_system_draft()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'draft' THEN
        PERFORM pg_notify(
            'ds_draft_invalidations',
            json_build_object(
                'designSystemId', NEW.design_system_id,
                'draftId', NEW.id,
                'draftRevision', NEW.revision,
                'actorId', COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system'),
                'clientId', NULLIF(current_setting('ds.client_id', true), ''),
                'changedAt', CURRENT_TIMESTAMP
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER design_system_versions_notify_new_draft
    AFTER INSERT ON design_system_versions
    FOR EACH ROW EXECUTE FUNCTION notify_new_design_system_draft();

-- Собирает крупные области данных вместо идентификаторов каждой изменённой строки.
-- Значение локально для транзакции и читается отложенным триггером увеличения редакции.
CREATE FUNCTION collect_draft_invalidation_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    scope text := TG_ARGV[0];
    scopes text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.invalidation_scopes', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    IF NOT scope = ANY(scopes) THEN
        PERFORM set_config(
            'ds.invalidation_scopes',
            array_to_string(array_append(scopes, scope), ','),
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
        ARRAY['design_system_revisions', 'design-system'],
        ARRAY['tenant_revisions', 'theme-metadata'],
        ARRAY['token_revisions', 'theme-tokens'],
        ARRAY['token_value_revisions', 'theme-tokens'],
        ARRAY['design_system_component_revisions', 'component-configurations'],
        ARRAY['appearance_revisions', 'component-configurations'],
        ARRAY['style_revisions', 'component-configurations'],
        ARRAY['component_reuse_config_revisions', 'component-configurations'],
        ARRAY['appearance_variation_revisions', 'component-configurations'],
        ARRAY['appearance_variation_value_revisions', 'component-configurations'],
        ARRAY['appearance_combination_revisions', 'component-configurations'],
        ARRAY['appearance_combination_member_revisions', 'component-configurations'],
        ARRAY['invariant_property_value_revisions', 'component-configurations'],
        ARRAY['invariant_platform_param_adjustment_revisions', 'component-configurations'],
        ARRAY['variation_property_value_revisions', 'component-configurations'],
        ARRAY['variation_platform_param_adjustment_revisions', 'component-configurations'],
        ARRAY['style_combination_revisions', 'component-configurations'],
        ARRAY['style_combination_member_revisions', 'component-configurations'],
        ARRAY['component_style_reference_revisions', 'component-configurations'],
        ARRAY['component_style_reference_style_revisions', 'component-configurations']
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_collect_invalidation_scope '
                || 'AFTER INSERT OR DELETE ON %I FOR EACH ROW '
                || 'EXECUTE FUNCTION collect_draft_invalidation_scope(%L)',
            item[1],
            item[1],
            item[2]
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bump_design_system_draft_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    boundary_id uuid := CASE WHEN TG_OP = 'DELETE'
        THEN OLD.design_system_version_id
        ELSE NEW.design_system_version_id
    END;
    boundary_design_system_id uuid;
    next_revision bigint;
    bumped_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.bumped_draft_ids', true), ''), ','),
        ARRAY[]::text[]
    );
    scopes text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.invalidation_scopes', true), ''), ','),
        ARRAY['all']::text[]
    );
    actor text := COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system');
    client_id text := NULLIF(current_setting('ds.client_id', true), '');
BEGIN
    IF boundary_id::text = ANY(bumped_ids) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    UPDATE design_system_versions
    SET revision = revision + 1
    WHERE id = boundary_id AND status = 'draft'
    RETURNING design_system_id, revision INTO boundary_design_system_id, next_revision;

    IF FOUND THEN
        PERFORM set_config(
            'ds.bumped_draft_ids',
            array_to_string(array_append(bumped_ids, boundary_id::text), ','),
            true
        );
        PERFORM pg_notify(
            'ds_draft_invalidations',
            json_build_object(
                'designSystemId', boundary_design_system_id,
                'draftId', boundary_id,
                'draftRevision', next_revision,
                'actorId', actor,
                'clientId', client_id,
                'changedAt', CURRENT_TIMESTAMP,
                'scopes', scopes
            )::text
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_design_system_draft()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'draft' THEN
        PERFORM pg_notify(
            'ds_draft_invalidations',
            json_build_object(
                'designSystemId', NEW.design_system_id,
                'draftId', NEW.id,
                'draftRevision', NEW.revision,
                'actorId', COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system'),
                'clientId', NULLIF(current_setting('ds.client_id', true), ''),
                'changedAt', CURRENT_TIMESTAMP,
                'scopes', ARRAY['all']::text[]
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Этап 5: V11__version_palette_and_token_groups.sql
-- Палитра темы и группы используют те же независимые границы, что токены.
-- Копия tenant_palette_template неизменяема; редакции для неё не создаются.

ALTER TABLE tenant_palette_groups ADD COLUMN design_system_id uuid;
UPDATE tenant_palette_groups g SET design_system_id = t.design_system_id FROM tenants t WHERE t.id = g.tenant_id;
ALTER TABLE tenant_palette_ramps ADD COLUMN design_system_id uuid;
UPDATE tenant_palette_ramps r SET design_system_id = g.design_system_id FROM tenant_palette_groups g WHERE g.id = r.group_id;
ALTER TABLE tenant_palette_steps ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN design_system_id uuid;
UPDATE tenant_palette_steps s SET design_system_id = r.design_system_id FROM tenant_palette_ramps r WHERE r.id = s.ramp_id;
ALTER TABLE tenant_palette_steps DROP CONSTRAINT tenant_palette_steps_pkey,
    ADD PRIMARY KEY (id), ADD UNIQUE (ramp_id, step);
ALTER TABLE tenant_palette_token_groups ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN design_system_id uuid;
UPDATE tenant_palette_token_groups a SET design_system_id = t.design_system_id FROM tenants t WHERE t.id = a.tenant_id;
ALTER TABLE tenant_palette_token_groups DROP CONSTRAINT tenant_palette_token_groups_pkey,
    ADD PRIMARY KEY (id), ADD UNIQUE (tenant_id, token_id);

CREATE TABLE tenant_palette_group_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    label text,
    position integer,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (deleted OR (label IS NOT NULL AND position IS NOT NULL))
);
CREATE TABLE tenant_palette_ramp_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ramp_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    source_type palette_type,
    source_shade text,
    added boolean,
    origin palette_ramp_origin,
    anchor_step integer,
    anchor_value text,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (deleted OR (source_type IS NOT NULL AND source_shade IS NOT NULL AND added IS NOT NULL AND origin IS NOT NULL)),
    CHECK ((anchor_step IS NULL) = (anchor_value IS NULL))
);
CREATE TABLE tenant_palette_step_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    value text,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (deleted OR value IS NOT NULL)
);
CREATE TABLE tenant_palette_token_group_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    group_id uuid,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (deleted OR group_id IS NOT NULL)
);
CREATE TABLE token_group_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    design_system_version_id uuid NOT NULL,
    version_sequence_number bigint NOT NULL,
    parent_id uuid,
    code text,
    label text,
    position integer,
    deleted boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (deleted OR (label IS NOT NULL AND position IS NOT NULL))
);

-- V6 уже расставила группы: переносим их без изменения UUID и порядка.
ALTER TABLE token_revisions ADD COLUMN group_id uuid, ADD COLUMN position integer NOT NULL DEFAULT 0;
ALTER TABLE token_revisions DISABLE TRIGGER token_revisions_touch_draft;
UPDATE token_revisions r SET group_id = t.group_id, position = t.position FROM tokens t WHERE t.id = r.token_id;
ALTER TABLE token_revisions ENABLE TRIGGER token_revisions_touch_draft;

INSERT INTO tenant_palette_group_revisions (
    group_id, design_system_id, design_system_version_id, version_sequence_number, label, position, updated_at
)
SELECT g.id, g.design_system_id, v.id, 0, g.label, g.position, g.updated_at
FROM tenant_palette_groups g JOIN design_system_versions v ON v.design_system_id = g.design_system_id AND v.status = 'baseline';
INSERT INTO tenant_palette_ramp_revisions (
    ramp_id, design_system_id, design_system_version_id, version_sequence_number,
    source_type, source_shade, added, origin, anchor_step, anchor_value, updated_at
)
SELECT r.id, r.design_system_id, v.id, 0, r.source_type, r.source_shade, r.added, r.origin, r.anchor_step, r.anchor_value, r.updated_at
FROM tenant_palette_ramps r JOIN design_system_versions v ON v.design_system_id = r.design_system_id AND v.status = 'baseline';
INSERT INTO tenant_palette_step_revisions (
    step_id, design_system_id, design_system_version_id, version_sequence_number, value
)
SELECT s.id, s.design_system_id, v.id, 0, s.value
FROM tenant_palette_steps s JOIN design_system_versions v ON v.design_system_id = s.design_system_id AND v.status = 'baseline';
INSERT INTO tenant_palette_token_group_revisions (
    assignment_id, design_system_id, design_system_version_id, version_sequence_number, group_id
)
SELECT a.id, a.design_system_id, v.id, 0, a.group_id
FROM tenant_palette_token_groups a JOIN design_system_versions v ON v.design_system_id = a.design_system_id AND v.status = 'baseline';
INSERT INTO token_group_revisions (
    group_id, design_system_id, design_system_version_id, version_sequence_number, parent_id, code, label, position, updated_at
)
SELECT g.id, g.design_system_id, v.id, 0, g.parent_id, g.code, g.label, g.position, g.updated_at
FROM token_groups g JOIN design_system_versions v ON v.design_system_id = g.design_system_id AND v.status = 'baseline';

-- Идентификатор ДС участвует во всех связях, включая ссылки на родителя и выбранную группу.
DO $$
DECLARE item text[];
BEGIN
    FOREACH item SLICE 1 IN ARRAY ARRAY[
        ARRAY['tenant_palette_groups', 'tenant_palette_group_revisions', 'group_id', 'palette-group'],
        ARRAY['tenant_palette_ramps', 'tenant_palette_ramp_revisions', 'ramp_id', 'palette-ramp'],
        ARRAY['tenant_palette_steps', 'tenant_palette_step_revisions', 'step_id', 'palette-step'],
        ARRAY['tenant_palette_token_groups', 'tenant_palette_token_group_revisions', 'assignment_id', 'palette-token-group'],
        ARRAY['token_groups', 'token_group_revisions', 'group_id', 'token-group']
    ] LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN design_system_id SET NOT NULL', item[1]);
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (id, design_system_id)', item[1], item[1] || '_version_owner_unique');
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I, design_system_id) REFERENCES %I (id, design_system_id) ON DELETE CASCADE, '
                || 'ADD CONSTRAINT %I FOREIGN KEY (design_system_version_id, version_sequence_number, design_system_id) '
                || 'REFERENCES design_system_versions (id, sequence_number, design_system_id) ON DELETE CASCADE, '
                || 'ADD CONSTRAINT %I UNIQUE (%I, design_system_version_id)',
            item[2], item[2] || '_entity_fk', item[3], item[1],
            item[2] || '_boundary_fk', item[2] || '_entity_boundary_unique', item[3]
        );
        EXECUTE format('CREATE INDEX %I ON %I (%I, version_sequence_number DESC)', item[2] || '_lookup', item[2], item[3]);
        EXECUTE format('CREATE INDEX %I ON %I (design_system_id, design_system_version_id)', item[2] || '_boundary', item[2]);
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION touch_design_system_draft_revision()',
            item[2] || '_touch_draft', item[2]);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION track_subject_edit_revision(%L, %L)',
            item[2] || '_edit_state', item[2], item[4], item[3]);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION compact_subject_draft_revision(%L, %L, %L)',
            item[2] || '_zz_compact', item[2], item[4], item[1], item[3]);
        EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED '
                || 'FOR EACH ROW EXECUTE FUNCTION bump_design_system_draft_revision()', item[2] || '_bump_draft', item[2]);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR DELETE ON %I FOR EACH ROW '
                || 'EXECUTE FUNCTION collect_draft_invalidation_scope(%L)', item[2] || '_collect_invalidation_scope', item[2], 'theme-tokens');
    END LOOP;
END;
$$;

ALTER TABLE tenant_palette_groups ADD CONSTRAINT tpg_tenant_owner_fk
    FOREIGN KEY (tenant_id, design_system_id) REFERENCES tenants (id, design_system_id) ON DELETE CASCADE;
ALTER TABLE tenant_palette_ramps ADD CONSTRAINT tpr_group_owner_fk
    FOREIGN KEY (group_id, design_system_id) REFERENCES tenant_palette_groups (id, design_system_id) ON DELETE RESTRICT;
ALTER TABLE tenant_palette_steps ADD CONSTRAINT tps_ramp_owner_fk
    FOREIGN KEY (ramp_id, design_system_id) REFERENCES tenant_palette_ramps (id, design_system_id) ON DELETE RESTRICT;
ALTER TABLE tenant_palette_token_groups ADD CONSTRAINT tptg_tenant_owner_fk
    FOREIGN KEY (tenant_id, design_system_id) REFERENCES tenants (id, design_system_id) ON DELETE CASCADE,
    ADD CONSTRAINT tptg_token_owner_fk FOREIGN KEY (token_id, design_system_id) REFERENCES tokens (id, design_system_id) ON DELETE RESTRICT;
ALTER TABLE tenant_palette_token_group_revisions ADD CONSTRAINT tptgr_group_owner_fk
    FOREIGN KEY (group_id, design_system_id) REFERENCES tenant_palette_groups (id, design_system_id) ON DELETE RESTRICT;
ALTER TABLE token_group_revisions ADD CONSTRAINT tgr_parent_owner_fk
    FOREIGN KEY (parent_id, design_system_id) REFERENCES token_groups (id, design_system_id) ON DELETE RESTRICT;
ALTER TABLE token_revisions ADD CONSTRAINT tr_group_owner_fk
    FOREIGN KEY (group_id, design_system_id) REFERENCES token_groups (id, design_system_id) ON DELETE RESTRICT;

-- Не сохраняем второй изменяемый источник. Ограничения активного состояния проверяются по редакциям.
DROP FUNCTION token_groups_initialize_color(uuid);
DROP FUNCTION token_groups_color_families(uuid);
ALTER TABLE tokens DROP COLUMN group_id, DROP COLUMN position;
ALTER TABLE tenant_palette_groups DROP COLUMN label, DROP COLUMN position, DROP COLUMN updated_at;
ALTER TABLE tenant_palette_ramps DROP COLUMN source_type, DROP COLUMN source_shade, DROP COLUMN added,
    DROP COLUMN origin, DROP COLUMN anchor_step, DROP COLUMN anchor_value, DROP COLUMN updated_at;
ALTER TABLE tenant_palette_steps DROP COLUMN value;
ALTER TABLE tenant_palette_token_groups DROP COLUMN group_id;
ALTER TABLE token_groups DROP COLUMN parent_id, DROP COLUMN code, DROP COLUMN label, DROP COLUMN position, DROP COLUMN updated_at;

-- Проверяются действующие редакции, а не все когда-либо существовавшие имена и связи.
-- Ограничение отложено до конца атомарной операции: перенос группы может затрагивать несколько строк.
CREATE FUNCTION enforce_palette_revision_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary_sequence bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    problem text;
    validation_key text := owner::text || ':' || boundary_sequence::text;
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.palette_checked_boundaries', true), ''), ','), ARRAY[]::text[]);
BEGIN
    -- Пакетная операция проверяет итоговый граф один раз, а не по разу на каждую редакцию.
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    WITH
    pg_latest AS (
        SELECT DISTINCT ON (g.id) g.id, g.tenant_id, r.label, r.deleted
        FROM tenant_palette_groups g JOIN tenant_palette_group_revisions r ON r.group_id = g.id
        WHERE g.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY g.id, r.version_sequence_number DESC
    ),
    pg AS (SELECT * FROM pg_latest WHERE NOT deleted),
    ramp_latest AS (
        SELECT DISTINCT ON (s.id) s.id, s.group_id, r.deleted FROM tenant_palette_ramps s
        JOIN tenant_palette_ramp_revisions r ON r.ramp_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    ramps AS (SELECT * FROM ramp_latest WHERE NOT deleted),
    step_latest AS (
        SELECT DISTINCT ON (s.id) s.ramp_id, r.deleted FROM tenant_palette_steps s
        JOIN tenant_palette_step_revisions r ON r.step_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    assignment_latest AS (
        SELECT DISTINCT ON (s.id) s.tenant_id, s.token_id, r.group_id, r.deleted FROM tenant_palette_token_groups s
        JOIN tenant_palette_token_group_revisions r ON r.assignment_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    group_latest AS (
        SELECT DISTINCT ON (s.id) s.id, s.kind, r.parent_id, r.code, r.label, r.deleted FROM token_groups s
        JOIN token_group_revisions r ON r.group_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    groups AS (SELECT * FROM group_latest WHERE NOT deleted),
    token_latest AS (
        SELECT DISTINCT ON (s.id) s.id, r.group_id, r.deleted FROM tokens s
        JOIN token_revisions r ON r.token_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    problems AS (
        SELECT 'unique_palette_group_label' AS reason FROM pg GROUP BY tenant_id, lower(label) HAVING count(*) > 1
        UNION ALL
        SELECT 'unique_token_group_label' FROM groups GROUP BY kind, parent_id, lower(label) HAVING count(*) > 1
        UNION ALL
        SELECT 'invalid_token_group_shape' FROM groups WHERE btrim(label) = ''
            OR (parent_id IS NULL) <> (code IS NOT NULL) OR (code IS NOT NULL AND code !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
        UNION ALL
        SELECT 'missing_palette_group' FROM ramps r WHERE NOT EXISTS (SELECT 1 FROM pg WHERE pg.id = r.group_id)
        UNION ALL
        SELECT 'missing_palette_ramp' FROM step_latest s WHERE NOT s.deleted
            AND NOT EXISTS (SELECT 1 FROM ramps r WHERE r.id = s.ramp_id)
        UNION ALL
        SELECT 'missing_palette_assignment_group' FROM assignment_latest a WHERE NOT a.deleted
            AND NOT EXISTS (SELECT 1 FROM pg WHERE pg.id = a.group_id AND pg.tenant_id = a.tenant_id)
        UNION ALL
        SELECT 'missing_token_group_parent' FROM groups child WHERE child.parent_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM groups parent WHERE parent.id = child.parent_id AND parent.parent_id IS NULL AND parent.kind = child.kind)
        UNION ALL
        SELECT 'missing_token_group' FROM token_latest t WHERE NOT t.deleted AND t.group_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = t.group_id)
    )
    SELECT reason INTO problem FROM problems LIMIT 1;
    IF problem IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = CASE WHEN problem LIKE 'unique_%' THEN '23505' ELSE '23503' END,
            MESSAGE = problem;
    END IF;
    PERFORM set_config('ds.palette_checked_boundaries', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

DO $$
DECLARE revision_table text;
BEGIN
    FOREACH revision_table IN ARRAY ARRAY[
        'tenant_palette_group_revisions', 'tenant_palette_ramp_revisions', 'tenant_palette_step_revisions',
        'tenant_palette_token_group_revisions', 'token_group_revisions', 'token_revisions'
    ] LOOP
        EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR DELETE ON %I '
            || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_palette_revision_integrity()',
            revision_table || '_palette_integrity', revision_table);
    END LOOP;
END;
$$;
