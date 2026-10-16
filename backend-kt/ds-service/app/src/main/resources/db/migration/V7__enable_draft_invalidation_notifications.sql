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
