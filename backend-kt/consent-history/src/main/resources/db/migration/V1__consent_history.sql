CREATE TABLE consent_history (
 subject_key_hash BYTEA NOT NULL CHECK (octet_length(subject_key_hash) = 32),
 client_group TEXT NOT NULL CHECK (client_group IN ('web', 'cli_mcp')),
 revision BIGINT NOT NULL CHECK (revision > 0),
 request_id UUID NOT NULL,
 decision TEXT NOT NULL CHECK (decision IN ('granted', 'denied', 'withdrawn')),
 policy_version TEXT NOT NULL,
 policy_sha256 BYTEA NOT NULL CHECK (octet_length(policy_sha256) = 32),
 received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 app_version VARCHAR(64),
 PRIMARY KEY (subject_key_hash, client_group, revision),
 UNIQUE (subject_key_hash, client_group, request_id)
);
