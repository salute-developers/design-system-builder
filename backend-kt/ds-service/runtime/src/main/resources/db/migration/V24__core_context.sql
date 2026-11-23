-- Релиз разрешается внутри предметной транзакции; историческая граница никогда не получает latest.
CREATE FUNCTION ds_selected_core_release(target_platform component_platform) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN NULLIF(current_setting('ds.version_id', true), '') IS NULL THEN
        (SELECT release_id FROM core_current_releases WHERE platform = target_platform)
    ELSE
        (SELECT binding.release_id FROM design_system_version_core_releases binding
         JOIN design_system_versions boundary ON boundary.id = binding.version_id
         WHERE binding.version_id = NULLIF(current_setting('ds.version_id', true), '')::uuid
           AND ds_request_matches_design_system(boundary.design_system_id) AND binding.platform = target_platform)
    END
$$;

CREATE FUNCTION protect_version_core_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_RELEASE_IMMUTABLE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER version_core_binding_immutable BEFORE UPDATE ON design_system_version_core_releases
    FOR EACH ROW EXECUTE FUNCTION protect_version_core_binding();

CREATE FUNCTION protect_version_preview_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.version_id, NEW.platform, NEW.release_id) IS DISTINCT FROM (OLD.version_id, OLD.platform, OLD.release_id)
       OR (OLD.build_id IS NOT NULL AND NEW.build_id IS DISTINCT FROM OLD.build_id) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_PREVIEW_IMMUTABLE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER version_preview_binding_immutable BEFORE UPDATE ON design_system_version_preview_builds
    FOR EACH ROW EXECUTE FUNCTION protect_version_preview_binding();
