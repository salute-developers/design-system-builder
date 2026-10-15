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
