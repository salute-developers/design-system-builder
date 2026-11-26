-- Фиксируем фактически использовавшийся Core существующих черновиков один раз.
ALTER TABLE design_system_versions ADD COLUMN core_selection_revision bigint NOT NULL DEFAULT 0
    CHECK (core_selection_revision >= 0);
INSERT INTO design_system_version_core_releases(version_id, platform, release_id)
SELECT v.id, c.platform, c.release_id FROM design_system_versions v CROSS JOIN core_current_releases c
WHERE v.status = 'draft' ON CONFLICT DO NOTHING;

-- Архивные snapshot-границы с NULL status не участвовали в сравнении status <> draft в V26.
-- Заполняем только отсутствующие привязки техническим снимком, не переписывая известное происхождение.
INSERT INTO design_system_version_core_releases(version_id, platform, release_id)
SELECT v.id, r.platform, r.id FROM design_system_versions v CROSS JOIN core_releases r
WHERE (v.status IS NULL OR v.status <> 'draft') AND r.provenance = 'migration-snapshot'
ON CONFLICT (version_id, platform) DO NOTHING;

CREATE OR REPLACE FUNCTION protect_version_core_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE boundary_id uuid;
BEGIN
    boundary_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
    IF EXISTS (SELECT 1 FROM design_system_versions WHERE id = boundary_id AND status IS DISTINCT FROM 'draft') THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_RELEASE_IMMUTABLE';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.version_id, NEW.platform) IS DISTINCT FROM (OLD.version_id, OLD.platform) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_RELEASE_IMMUTABLE';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER version_core_binding_immutable ON design_system_version_core_releases;
CREATE TRIGGER version_core_binding_immutable BEFORE INSERT OR UPDATE OR DELETE
ON design_system_version_core_releases FOR EACH ROW EXECUTE FUNCTION protect_version_core_binding();

CREATE OR REPLACE FUNCTION ds_selected_core_release(target_platform component_platform)
RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT binding.release_id FROM design_system_version_core_releases binding
    JOIN design_system_versions boundary ON boundary.id = binding.version_id
    WHERE boundary.design_system_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
      AND ds_request_matches_design_system(boundary.design_system_id)
      AND binding.platform = target_platform
      AND CASE WHEN NULLIF(current_setting('ds.version_id', true), '') IS NULL
          THEN boundary.status = 'draft'
          ELSE boundary.id = NULLIF(current_setting('ds.version_id', true), '')::uuid END
$$;
