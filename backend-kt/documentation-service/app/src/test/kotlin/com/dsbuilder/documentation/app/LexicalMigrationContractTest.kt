package com.dsbuilder.documentation.app

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LexicalMigrationContractTest {
    private val sql by lazy {
        requireNotNull(javaClass.getResource("/db/migration/V1__documentation_schema.sql")).readText()
    }

    @Test
    fun `baseline contains only final indexed lexical projections`() {
        listOf(
            "technical_search_vector",
            "russian_search_vector",
            "english_search_vector",
            "gin (technical_search_vector)",
            "gin (russian_search_vector)",
            "gin (english_search_vector)",
            "structured_lookup_terms_normalized_prefix_idx",
            "structured_lookup_terms_tokenized_prefix_idx",
            "text_pattern_ops",
            "structured_lookup_terms_normalized_trgm_idx",
            "structured_lookup_terms_tokenized_trgm_idx",
            "([[:lower:][:digit:]])([[:upper:]])",
        ).forEach { expected -> assertTrue(sql.contains(expected), "Baseline must contain $expected") }

        assertFalse(sql.contains("technical_search_vector_v2"))
        assertFalse(sql.contains("knowledge_chunks_fts_idx"))
        assertFalse(sql.contains("IF NOT EXISTS"))
    }

    @Test
    fun `baseline creates final active publication key and lookup representation`() {
        assertTrue(sql.contains("PRIMARY KEY (project_id, design_system_id, design_system_version, platform)"))
        assertTrue(sql.contains("tokenized TEXT NOT NULL"))
        assertTrue(sql.contains("CREATE EXTENSION pg_trgm"))
    }
}
