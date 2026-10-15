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
