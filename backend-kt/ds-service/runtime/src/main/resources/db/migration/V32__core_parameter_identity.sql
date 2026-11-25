-- Платформа и владелец импортированного параметра участвуют в разрешении исторического Core.
CREATE FUNCTION protect_core_parameter_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.platform, NEW.property_id) IS DISTINCT FROM (OLD.platform, OLD.property_id)
       AND EXISTS (SELECT 1 FROM core_release_platform_params WHERE platform_param_id = OLD.id) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_IDENTITY_IMMUTABLE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER platform_params_core_identity BEFORE UPDATE ON property_platform_params
    FOR EACH ROW EXECUTE FUNCTION protect_core_parameter_identity();
CREATE INDEX core_parameter_identity_lookup ON core_release_platform_params(platform_param_id);
