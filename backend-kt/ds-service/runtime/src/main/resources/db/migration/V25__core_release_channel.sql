-- Существующий канал неизвестен: не угадываем его по номеру версии.
ALTER TABLE core_releases ADD COLUMN channel text CHECK (channel IN ('stable', 'dev'));

-- Старые записи могут сохранять NULL, новые релизы требуют явный канал.
CREATE FUNCTION require_core_release_channel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.channel IS NULL AND NEW.provenance = 'imported' THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_RELEASE_METADATA_REQUIRED';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER core_release_channel_required BEFORE INSERT ON core_releases
    FOR EACH ROW EXECUTE FUNCTION require_core_release_channel();
