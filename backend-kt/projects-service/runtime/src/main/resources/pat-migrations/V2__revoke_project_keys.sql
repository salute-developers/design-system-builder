DO $$
BEGIN
    IF to_regclass('project_access_keys') IS NOT NULL THEN
        UPDATE project_access_keys
        SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE revoked_at IS NULL;
    END IF;
END
$$;
