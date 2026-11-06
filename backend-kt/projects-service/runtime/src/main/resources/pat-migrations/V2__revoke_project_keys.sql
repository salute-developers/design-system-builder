UPDATE project_access_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL;
