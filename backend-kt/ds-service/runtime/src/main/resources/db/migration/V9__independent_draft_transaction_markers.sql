-- Отметки не содержат предметных значений и не являются пользовательским журналом.
CREATE TABLE draft_transaction_markers (
    id uuid PRIMARY KEY,
    design_system_version_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    scopes text[] NOT NULL,
    actor_id text NOT NULL,
    client_id text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT draft_marker_boundary_fk FOREIGN KEY (design_system_version_id, design_system_id)
        REFERENCES design_system_versions (id, design_system_id) ON DELETE CASCADE
);
CREATE INDEX draft_markers_boundary_idx ON draft_transaction_markers(design_system_version_id);

CREATE FUNCTION resolved_draft_revision(boundary_id uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
    SELECT boundary.revision + CASE WHEN boundary.status = 'draft' THEN
        (SELECT count(*) FROM draft_transaction_markers marker WHERE marker.design_system_version_id = boundary.id)
        ELSE 0 END
    FROM design_system_versions boundary WHERE boundary.id = boundary_id
$$;

CREATE FUNCTION protect_draft_transaction_marker() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' OR (TG_OP = 'DELETE' AND EXISTS (
        SELECT 1 FROM design_system_versions WHERE id = OLD.design_system_version_id AND status = 'draft'
    )) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'active_draft_markers_are_immutable';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER immutable_draft_transaction_marker BEFORE UPDATE OR DELETE ON draft_transaction_markers
    FOR EACH ROW EXECUTE FUNCTION protect_draft_transaction_marker();

CREATE OR REPLACE FUNCTION bump_design_system_draft_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    boundary_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.design_system_version_id ELSE NEW.design_system_version_id END;
    owner uuid;
    marker_id uuid := gen_random_uuid();
    bumped_ids text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.bumped_draft_ids', true), ''), ','), ARRAY[]::text[]);
    scopes text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.invalidation_scopes', true), ''), ','), ARRAY['all']::text[]);
    actor text := COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system');
    client text := NULLIF(current_setting('ds.client_id', true), '');
BEGIN
    IF boundary_id::text = ANY(bumped_ids) THEN RETURN COALESCE(NEW, OLD); END IF;
    SELECT design_system_id INTO owner FROM design_system_versions WHERE id = boundary_id AND status = 'draft';
    IF NOT FOUND THEN RETURN COALESCE(NEW, OLD); END IF;
    INSERT INTO draft_transaction_markers(id, design_system_version_id, design_system_id, scopes, actor_id, client_id)
        VALUES(marker_id, boundary_id, owner, scopes, actor, client);
    PERFORM set_config('ds.bumped_draft_ids', array_to_string(array_append(bumped_ids, boundary_id::text), ','), true);
    PERFORM pg_notify('ds_draft_invalidations', json_build_object(
        'eventId', marker_id, 'designSystemId', owner, 'draftId', boundary_id,
        'actorId', actor, 'clientId', client, 'changedAt', CURRENT_TIMESTAMP, 'scopes', scopes
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_design_system_draft() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'draft' THEN
        PERFORM pg_notify('ds_draft_invalidations', json_build_object(
            'eventId', gen_random_uuid(), 'designSystemId', NEW.design_system_id, 'draftId', NEW.id,
            'actorId', COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system'),
            'clientId', NULLIF(current_setting('ds.client_id', true), ''),
            'changedAt', CURRENT_TIMESTAMP, 'scopes', ARRAY['all']::text[]
        )::text);
    END IF;
    RETURN NEW;
END;
$$;
