ALTER TABLE documentation_bundles
    ADD COLUMN IF NOT EXISTS storage_deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS publication_cleanup_jobs (
    publication_id VARCHAR(80) PRIMARY KEY
        REFERENCES documentation_publications(id) ON DELETE CASCADE,
    state VARCHAR(32) NOT NULL,
    eligible_at TIMESTAMPTZ NOT NULL,
    lease_owner VARCHAR(128),
    lease_until TIMESTAMPTZ,
    attempt INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_failure_class VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT publication_cleanup_jobs_state_check
        CHECK (state IN ('pending', 'leased', 'retry_wait', 'blocked')),
    CONSTRAINT publication_cleanup_jobs_attempt_check CHECK (attempt >= 0),
    CONSTRAINT publication_cleanup_jobs_failure_class_check CHECK (
        last_failure_class IS NULL OR last_failure_class IN ('object_storage', 'database', 'invariant')
    ),
    CONSTRAINT publication_cleanup_jobs_lease_check CHECK (
        (state = 'leased' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL)
        OR (state <> 'leased' AND lease_owner IS NULL AND lease_until IS NULL)
    ),
    CONSTRAINT publication_cleanup_jobs_retry_check CHECK (
        (state = 'retry_wait' AND next_attempt_at IS NOT NULL)
        OR (state <> 'retry_wait' AND next_attempt_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS publication_cleanup_jobs_claim_idx
    ON publication_cleanup_jobs(state, eligible_at, next_attempt_at, lease_until, created_at)
    WHERE state IN ('pending', 'leased', 'retry_wait');

WITH migration_clock AS MATERIALIZED (
    SELECT now() AS migrated_at
)
INSERT INTO publication_cleanup_jobs (
    publication_id,
    state,
    eligible_at,
    attempt,
    created_at,
    updated_at
)
SELECT
    publication.id,
    'pending',
    migration_clock.migrated_at + INTERVAL '24 hours',
    0,
    migration_clock.migrated_at,
    migration_clock.migrated_at
FROM documentation_publications publication
CROSS JOIN migration_clock
WHERE publication.status = 'superseded'
ON CONFLICT (publication_id) DO NOTHING;
