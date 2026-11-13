CREATE EXTENSION pg_trgm;

CREATE TABLE documentation_bundles (
    id VARCHAR(80) PRIMARY KEY,
    project_id VARCHAR(80) NOT NULL,
    design_system_id VARCHAR(128) NOT NULL,
    design_system_version VARCHAR(128) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    schema_version VARCHAR(32) NOT NULL,
    storage_bucket VARCHAR(255) NOT NULL,
    storage_key VARCHAR(1024) NOT NULL UNIQUE,
    sha256 VARCHAR(64) NOT NULL,
    compressed_size BIGINT NOT NULL,
    uncompressed_size BIGINT NOT NULL,
    original_filename VARCHAR(512),
    manifest_json TEXT NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(128) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX documentation_bundles_project_idx ON documentation_bundles(project_id);
CREATE INDEX documentation_bundles_design_system_idx ON documentation_bundles(design_system_id);
CREATE INDEX documentation_bundles_sha256_idx ON documentation_bundles(sha256);

CREATE TABLE ingestion_jobs (
    id VARCHAR(80) PRIMARY KEY,
    bundle_id VARCHAR(80) NOT NULL UNIQUE REFERENCES documentation_bundles(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    current_step VARCHAR(32) NOT NULL DEFAULT 'accepted',
    publication_id VARCHAR(80),
    attempt INTEGER NOT NULL DEFAULT 0,
    worker_id VARCHAR(128),
    lease_until TIMESTAMPTZ,
    progress_completed INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 5,
    progress_processed BIGINT NOT NULL DEFAULT 0,
    progress_items_total BIGINT,
    failure_code VARCHAR(128),
    failure_message TEXT,
    failure_retryable BOOLEAN,
    started_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX ingestion_jobs_status_idx ON ingestion_jobs(status);
CREATE INDEX ingestion_jobs_claim_idx
    ON ingestion_jobs(status, lease_until, created_at)
    WHERE status IN ('accepted', 'validating', 'normalizing', 'chunking', 'indexing', 'publishing');

CREATE TABLE processing_diagnostics (
    id VARCHAR(128) PRIMARY KEY,
    job_id VARCHAR(80) NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    level VARCHAR(16) NOT NULL,
    code VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    path VARCHAR(1024),
    artifact_type VARCHAR(64),
    subject VARCHAR(512),
    details JSONB,
    ordinal INTEGER NOT NULL,
    UNIQUE (job_id, ordinal)
);

CREATE TABLE documentation_publications (
    id VARCHAR(80) PRIMARY KEY,
    project_id VARCHAR(80) NOT NULL,
    bundle_id VARCHAR(80) NOT NULL UNIQUE REFERENCES documentation_bundles(id),
    design_system_id VARCHAR(128) NOT NULL,
    design_system_version VARCHAR(128) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ
);
CREATE INDEX documentation_publications_project_idx ON documentation_publications(project_id);
CREATE INDEX documentation_publications_key_idx
    ON documentation_publications(design_system_id, design_system_version, platform, status);

CREATE TABLE active_documentation_publications (
    project_id VARCHAR(80) NOT NULL,
    design_system_id VARCHAR(128) NOT NULL,
    design_system_version VARCHAR(128) NOT NULL,
    platform VARCHAR(64) NOT NULL,
    publication_id VARCHAR(80) NOT NULL UNIQUE REFERENCES documentation_publications(id),
    activated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (project_id, design_system_id, design_system_version, platform)
);

CREATE TABLE documentation_navigation_nodes (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    parent_id VARCHAR(128) REFERENCES documentation_navigation_nodes(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL,
    title TEXT NOT NULL,
    page_path VARCHAR(1024),
    ordinal INTEGER NOT NULL,
    UNIQUE (publication_id, parent_id, ordinal)
);

CREATE TABLE documentation_pages (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    path VARCHAR(1024) NOT NULL,
    title TEXT NOT NULL,
    subjects JSONB NOT NULL,
    UNIQUE (publication_id, path)
);

CREATE TABLE documentation_content (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    page_id VARCHAR(128) NOT NULL REFERENCES documentation_pages(id) ON DELETE CASCADE,
    source_path VARCHAR(1024) NOT NULL,
    source VARCHAR(16) NOT NULL,
    ordinal INTEGER NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    size BIGINT NOT NULL,
    UNIQUE (page_id, ordinal),
    UNIQUE (publication_id, source_path)
);

CREATE TABLE documentation_assets (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    path VARCHAR(1024) NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    media_type VARCHAR(255) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    size BIGINT NOT NULL,
    UNIQUE (publication_id, path)
);

CREATE TABLE documentation_content_assets (
    content_id VARCHAR(128) NOT NULL REFERENCES documentation_content(id) ON DELETE CASCADE,
    asset_id VARCHAR(128) NOT NULL REFERENCES documentation_assets(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, asset_id)
);

CREATE TABLE structured_artifacts (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    format VARCHAR(128) NOT NULL,
    storage_key VARCHAR(1024) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    size BIGINT NOT NULL,
    UNIQUE (publication_id, type)
);

CREATE TABLE code_bindings (
    id VARCHAR(128) PRIMARY KEY,
    structured_artifact_id VARCHAR(128) NOT NULL REFERENCES structured_artifacts(id) ON DELETE CASCADE,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    subject VARCHAR(512) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    platform VARCHAR(64) NOT NULL,
    platform_payload JSONB NOT NULL,
    technical_projection TEXT NOT NULL,
    UNIQUE (publication_id, kind, subject)
);
CREATE INDEX code_bindings_subject_idx ON code_bindings(publication_id, subject);
CREATE INDEX code_bindings_name_trgm_idx ON code_bindings USING gin (name gin_trgm_ops);
CREATE INDEX code_bindings_technical_trgm_idx ON code_bindings USING gin (technical_projection gin_trgm_ops);

CREATE TABLE structured_lookup_terms (
    id VARCHAR(128) PRIMARY KEY,
    code_binding_id VARCHAR(128) NOT NULL REFERENCES code_bindings(id) ON DELETE CASCADE,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    original TEXT NOT NULL,
    normalized TEXT NOT NULL,
    tokenized TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    UNIQUE (code_binding_id, category, original)
);
CREATE INDEX structured_lookup_terms_normalized_prefix_idx
    ON structured_lookup_terms(publication_id, normalized text_pattern_ops);
CREATE INDEX structured_lookup_terms_tokenized_prefix_idx
    ON structured_lookup_terms(publication_id, tokenized text_pattern_ops);
CREATE INDEX structured_lookup_terms_normalized_trgm_idx
    ON structured_lookup_terms USING gin (normalized gin_trgm_ops);
CREATE INDEX structured_lookup_terms_tokenized_trgm_idx
    ON structured_lookup_terms USING gin (tokenized gin_trgm_ops);

CREATE TABLE knowledge_chunks (
    id VARCHAR(128) PRIMARY KEY,
    publication_id VARCHAR(80) NOT NULL REFERENCES documentation_publications(id) ON DELETE CASCADE,
    page_id VARCHAR(128) NOT NULL REFERENCES documentation_pages(id) ON DELETE CASCADE,
    content_id VARCHAR(128) NOT NULL REFERENCES documentation_content(id) ON DELETE CASCADE,
    source_path VARCHAR(1024) NOT NULL,
    ordinal INTEGER NOT NULL,
    heading_path JSONB NOT NULL,
    page_title TEXT NOT NULL,
    markdown TEXT NOT NULL,
    search_text TEXT NOT NULL,
    code_text TEXT NOT NULL,
    subjects JSONB NOT NULL,
    approximate_size INTEGER NOT NULL,
    kb_url VARCHAR(1024) NOT NULL,
    technical_search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(
            to_tsvector(
                'simple',
                coalesce(page_title, '') || ' ' ||
                regexp_replace(coalesce(page_title, ''), '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g')
            ),
            'A'
        ) ||
        setweight(
            to_tsvector(
                'simple',
                coalesce(heading_path::text, '') || ' ' ||
                regexp_replace(coalesce(heading_path::text, ''), '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g')
            ),
            'A'
        ) ||
        setweight(to_tsvector('simple', coalesce(subjects::text, '')), 'A') ||
        setweight(
            to_tsvector(
                'simple',
                coalesce(source_path, '') || ' ' ||
                regexp_replace(coalesce(source_path, ''), '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g') || ' ' ||
                coalesce(code_text, '') || ' ' ||
                regexp_replace(coalesce(code_text, ''), '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g')
            ),
            'B'
        ) ||
        setweight(
            to_tsvector(
                'simple',
                coalesce(search_text, '') || ' ' ||
                regexp_replace(coalesce(search_text, ''), '([[:lower:][:digit:]])([[:upper:]])', '\1 \2', 'g')
            ),
            'C'
        )
    ) STORED,
    russian_search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('russian', coalesce(page_title, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(heading_path::text, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(search_text, '')), 'C')
    ) STORED,
    english_search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(page_title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(heading_path::text, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(search_text, '')), 'C')
    ) STORED,
    UNIQUE (content_id, ordinal),
    UNIQUE (publication_id, kb_url)
);
CREATE INDEX knowledge_chunks_technical_fts_idx
    ON knowledge_chunks USING gin (technical_search_vector);
CREATE INDEX knowledge_chunks_russian_fts_idx
    ON knowledge_chunks USING gin (russian_search_vector);
CREATE INDEX knowledge_chunks_english_fts_idx
    ON knowledge_chunks USING gin (english_search_vector);
CREATE INDEX knowledge_chunks_source_trgm_idx
    ON knowledge_chunks USING gin (source_path gin_trgm_ops);
