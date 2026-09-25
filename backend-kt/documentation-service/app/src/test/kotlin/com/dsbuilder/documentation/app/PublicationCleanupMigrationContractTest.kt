package com.dsbuilder.documentation.app

import kotlin.test.Test
import kotlin.test.assertTrue

class PublicationCleanupMigrationContractTest {
    private val sql by lazy {
        requireNotNull(javaClass.getResource("/db/migration/V2__publication_cleanup_lifecycle.sql")).readText()
    }

    @Test
    fun `migration creates fenced cascade queue and exact backfill`() {
        listOf(
            "publication_cleanup_jobs",
            "REFERENCES documentation_publications(id) ON DELETE CASCADE",
            "publication_cleanup_jobs_claim_idx",
            "storage_deleted_at",
            "publication.status = 'superseded'",
            "INTERVAL '24 hours'",
            "ON CONFLICT (publication_id) DO NOTHING",
        ).forEach { expected -> assertTrue(sql.contains(expected), "Migration must contain $expected") }
    }

    @Test
    fun `migration is safe if additive objects already exist`() {
        assertTrue(sql.contains("ADD COLUMN IF NOT EXISTS storage_deleted_at"))
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS publication_cleanup_jobs"))
        assertTrue(sql.contains("CREATE INDEX IF NOT EXISTS publication_cleanup_jobs_claim_idx"))
    }
}
