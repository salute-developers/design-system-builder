CREATE TABLE personal_access_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    name VARCHAR(80) NOT NULL,
    scopes TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX personal_access_tokens_user_id_idx ON personal_access_tokens(user_id);
