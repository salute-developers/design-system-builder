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
