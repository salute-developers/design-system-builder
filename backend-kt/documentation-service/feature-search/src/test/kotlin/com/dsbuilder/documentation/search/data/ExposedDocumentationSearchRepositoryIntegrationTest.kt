package com.dsbuilder.documentation.search.data

import com.dsbuilder.documentation.search.application.DocumentationSearchOutcome
import com.dsbuilder.documentation.search.application.DocumentationSearchRequest
import com.dsbuilder.documentation.search.application.DocumentationSearchResultDto
import com.dsbuilder.documentation.search.application.KnowledgeUrl
import com.dsbuilder.documentation.search.application.LexicalRankingProfile
import com.dsbuilder.documentation.search.application.LexicalSearchQuery
import com.dsbuilder.documentation.search.application.MarkdownTitleMatch
import com.dsbuilder.documentation.search.application.SearchDocumentationUseCase
import com.dsbuilder.documentation.search.application.StructuredMatchKind
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import java.sql.DriverManager
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExposedDocumentationSearchRepositoryIntegrationTest {
    private val url = System.getenv(TEST_DATABASE_URL)?.also(::requireTestDatabase)
    private val user = System.getenv(TEST_DATABASE_USER) ?: "documentation"
    private val password = System.getenv(TEST_DATABASE_PASSWORD) ?: "documentation"
    private val repository by lazy {
        ExposedDocumentationSearchRepository(
            Database.connect(requireNotNull(url), POSTGRES_DRIVER, user, password),
        )
    }

    @BeforeTest
    fun prepare() {
        if (url == null) return
        sql("TRUNCATE documentation_bundles CASCADE")
        seed()
    }

    @AfterTest
    fun cleanup() {
        if (url == null) return
        sql("TRUNCATE documentation_bundles CASCADE")
    }

    @Test
    fun `active scoped structured and fts search work through exposed expressions`() = runBlocking {
        if (url == null) return@runBlocking
        assertEquals("pub", repository.resolve("project-a", "ds", "1", "compose"))
        assertNull(repository.resolve("project-b", "ds", "1", "compose"))

        val exact = repository.structured("pub", query("Button.Primary"), emptySet(), 20, profile)
        assertEquals(StructuredMatchKind.EXACT_REFERENCE, exact.single().match)
        assertTrue(repository.structured("pub", query("Button"), setOf("components.other"), 20, profile).isEmpty())
        assertTrue(
            repository.markdown("pub", query("кнопка Button"), setOf("components.button"), 20, profile).isNotEmpty(),
        )
    }

    @Test
    fun `knowledge fetch checks canonical url and project ownership`() = runBlocking {
        if (url == null) return@runBlocking
        val url = requireNotNull(KnowledgeUrl.parse("dsb://documentation/pub/content/0"))
        assertEquals("# Button", assertNotNull(repository.fetch("project-a", url)).markdown)
        assertNull(repository.fetch("project-b", url))
    }

    @Test
    fun `postgres search channels enforce candidate limit`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                INSERT INTO code_bindings (
                    id, structured_artifact_id, publication_id, subject, kind, name, platform,
                    platform_payload, technical_projection
                ) VALUES
                    ('binding-2', 'artifact', 'pub', 'components.button-secondary', 'component-style',
                        'Button Secondary', 'compose', '{}', 'Button.Secondary'),
                    ('binding-3', 'artifact', 'pub', 'components.button-tertiary', 'component-style',
                        'Button Tertiary', 'compose', '{}', 'Button.Tertiary');
                INSERT INTO structured_lookup_terms (
                    id, code_binding_id, publication_id, original, normalized, tokenized, category
                ) VALUES
                    ('term-2', 'binding-2', 'pub', 'Button.Secondary', 'button.secondary', 'button secondary', 'reference'),
                    ('term-3', 'binding-3', 'pub', 'Button.Tertiary', 'button.tertiary', 'button tertiary', 'reference');
                INSERT INTO knowledge_chunks (
                    id, publication_id, page_id, content_id, source_path, ordinal, heading_path,
                    page_title, markdown, search_text, code_text, subjects, approximate_size, kb_url
                ) VALUES
                    ('chunk-2', 'pub', 'page', 'content', 'docs/button.md', 1, '["Button"]',
                        'Button secondary', '# Button secondary', 'Русская кнопка Button', '',
                        '["components.button"]', 8, 'dsb://documentation/pub/content/1'),
                    ('chunk-3', 'pub', 'page', 'content', 'docs/button.md', 2, '["Button"]',
                        'Button tertiary', '# Button tertiary', 'Русская кнопка Button', '',
                        '["components.button"]', 8, 'dsb://documentation/pub/content/2');
            """.trimIndent(),
        )

        assertEquals(1, repository.structured("pub", query("Button"), emptySet(), 1, profile).size)
        assertEquals(3, repository.markdown("pub", query("кнопка Button"), emptySet(), 1, profile).size)
    }

    @Test
    fun `structured prefix treats percent underscore and backslash literally`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                INSERT INTO code_bindings (
                    id, structured_artifact_id, publication_id, subject, kind, name, platform,
                    platform_payload, technical_projection
                ) VALUES
                    ('binding-underscore', 'artifact', 'pub', 'components.underscore', 'component-style',
                        'Underscore', 'compose', '{}', 'size_72'),
                    ('binding-underscore-wildcard', 'artifact', 'pub', 'components.underscore-wildcard',
                        'component-style', 'Underscore wildcard', 'compose', '{}', 'sizex72'),
                    ('binding-percent', 'artifact', 'pub', 'components.percent', 'component-style',
                        'Percent', 'compose', '{}', 'rate%value'),
                    ('binding-percent-wildcard', 'artifact', 'pub', 'components.percent-wildcard',
                        'component-style', 'Percent wildcard', 'compose', '{}', 'ratexvalue'),
                    ('binding-backslash', 'artifact', 'pub', 'components.backslash', 'component-style',
                        'Backslash', 'compose', '{}', 'path\value'),
                    ('binding-backslash-wildcard', 'artifact', 'pub', 'components.backslash-wildcard',
                        'component-style', 'Backslash wildcard', 'compose', '{}', 'pathvalue');
                INSERT INTO structured_lookup_terms (
                    id, code_binding_id, publication_id, original, normalized, tokenized, category
                ) VALUES
                    ('term-underscore', 'binding-underscore', 'pub', 'size_72', 'size_72', 'size 72', 'reference'),
                    ('term-underscore-wildcard', 'binding-underscore-wildcard', 'pub', 'sizex72', 'sizex72',
                        'sizex72', 'reference'),
                    ('term-percent', 'binding-percent', 'pub', 'rate%value', 'rate%value', 'rate value', 'reference'),
                    ('term-percent-wildcard', 'binding-percent-wildcard', 'pub', 'ratexvalue', 'ratexvalue',
                        'ratexvalue', 'reference'),
                    ('term-backslash', 'binding-backslash', 'pub', 'path\value', 'path\value', 'path value', 'reference'),
                    ('term-backslash-wildcard', 'binding-backslash-wildcard', 'pub', 'pathvalue', 'pathvalue',
                        'pathvalue', 'reference');
            """.trimIndent(),
        )
        val literalProfile = profile.copy(fuzzyMinimumLength = 100)

        assertEquals(
            listOf("binding-underscore"),
            repository.structured("pub", query("size_72"), emptySet(), 20, literalProfile).map { it.codeBindingId },
        )
        assertEquals(
            listOf("binding-percent"),
            repository.structured("pub", query("rate%value"), emptySet(), 20, literalProfile).map { it.codeBindingId },
        )
        assertEquals(
            listOf("binding-backslash"),
            repository.structured("pub", query("path\\value"), emptySet(), 20, literalProfile).map { it.codeBindingId },
        )
    }

    @Test
    fun `structured prefix uses dedicated indexes on production like corpus`() {
        if (url == null) return
        sql(
            """
                INSERT INTO structured_lookup_terms (
                    id, code_binding_id, publication_id, original, normalized, tokenized, category
                )
                SELECT 'plan-term-' || value, 'binding', 'pub', 'Noise-' || value,
                       'noise-' || lpad(value::text, 5, '0'), 'noise ' || lpad(value::text, 5, '0'), 'name'
                FROM generate_series(1, 10400) value;
                INSERT INTO structured_lookup_terms (
                    id, code_binding_id, publication_id, original, normalized, tokenized, category
                ) VALUES ('plan-term-match', 'binding', 'pub', 'NeedleIndex', 'needleindex',
                    'needle index', 'qualified-name');
                ANALYZE structured_lookup_terms;
            """.trimIndent(),
        )

        val plan = queryPlan(
            """
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT id, subject, kind, name, original, category, strength, evidence
                FROM (
                    SELECT candidates.*, row_number() OVER (
                        PARTITION BY id ORDER BY strength, normalized, original, category
                    ) AS logical_rank
                    FROM (
                        SELECT b.id, b.subject, b.kind, b.name, t.original, t.category, t.normalized,
                               3 AS strength, 1.0::double precision AS evidence
                        FROM (
                            SELECT *
                            FROM structured_lookup_terms
                            WHERE publication_id = 'pub' AND normalized LIKE 'needle%' ESCAPE E'\\'
                            UNION ALL
                            SELECT *
                            FROM structured_lookup_terms
                            WHERE publication_id = 'pub' AND tokenized LIKE 'needle%' ESCAPE E'\\'
                        ) t
                        JOIN code_bindings b ON b.id = t.code_binding_id
                    ) candidates
                ) logical_candidates
                WHERE logical_rank = 1
                ORDER BY strength, normalized, subject, id
                LIMIT 20;
            """.trimIndent(),
        )

        assertTrue("structured_lookup_terms_normalized_prefix_idx" in plan, plan)
        assertTrue("structured_lookup_terms_tokenized_prefix_idx" in plan, plan)
        assertTrue("Seq Scan on structured_lookup_terms" !in plan, plan)
    }

    @Test
    fun `structured candidate limit applies after logical binding deduplication`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                INSERT INTO code_bindings (
                    id, structured_artifact_id, publication_id, subject, kind, name, platform,
                    platform_payload, technical_projection
                ) VALUES
                    ('binding-heavy', 'artifact', 'pub', 'components.a-heavy', 'component-style',
                        'Heavy', 'compose', '{}', 'NeedleCandidate'),
                    ('binding-other', 'artifact', 'pub', 'components.z-other', 'component-style',
                        'Other', 'compose', '{}', 'NeedleCandidate');
                INSERT INTO structured_lookup_terms (
                    id, code_binding_id, publication_id, original, normalized, tokenized, category
                ) VALUES
                    ('term-heavy-1', 'binding-heavy', 'pub', 'NeedleCandidate', 'needlecandidate',
                        'needle candidate', 'name'),
                    ('term-heavy-2', 'binding-heavy', 'pub', 'NEEDLECANDIDATE', 'needlecandidate',
                        'needle candidate', 'key'),
                    ('term-heavy-3', 'binding-heavy', 'pub', 'needlecandidate', 'needlecandidate',
                        'needle candidate', 'holder'),
                    ('term-heavy-4', 'binding-heavy', 'pub', 'Needlecandidate', 'needlecandidate',
                        'needle candidate', 'class-name'),
                    ('term-other', 'binding-other', 'pub', 'NeedleCandidate', 'needlecandidate',
                        'needle candidate', 'name');
            """.trimIndent(),
        )

        val results = repository.structured("pub", query("Needle"), emptySet(), 2, profile)

        assertEquals(setOf("binding-heavy", "binding-other"), results.map { it.codeBindingId }.toSet())
        assertEquals(2, results.size)
    }

    @Test
    fun `markdown subject filter is applied before candidate limit`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                INSERT INTO knowledge_chunks (
                    id, publication_id, page_id, content_id, source_path, ordinal, heading_path,
                    page_title, markdown, search_text, code_text, subjects, approximate_size, kb_url
                ) VALUES
                    ('chunk-wrong-subject', 'pub', 'page', 'content', 'docs/button.md', 1, '[]',
                        'Needle Needle Needle', '# Needle', 'Needle Needle Needle', '',
                        '["components.other"]', 10, 'dsb://documentation/pub/content/1'),
                    ('chunk-right-subject', 'pub', 'page', 'content', 'docs/button.md', 2, '[]',
                        'Other title', '# Other title', 'Needle', '',
                        '["components.target"]', 10, 'dsb://documentation/pub/content/2');
            """.trimIndent(),
        )

        val results = repository.markdown("pub", query("Needle"), setOf("components.target"), 1, profile)

        assertEquals(listOf("dsb://documentation/pub/content/2"), results.map { it.kbUrl }.distinct())
    }

    @Test
    fun `morphology typo and match centered snippet are explainable and stable`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                UPDATE knowledge_chunks SET search_text =
                    'Начальный нерелевантный контекст который специально длиннее обычного вступления. ' ||
                    repeat('padding ', 30) ||
                    '<script>alert(1)</script> состоянием кнопки управляет disabled property buttons'
                WHERE id = 'chunk';
            """.trimIndent(),
        )

        val russian = repository.markdown("pub", query("состояние"), emptySet(), 20, profile)
        val english = repository.markdown("pub", query("button disabled"), emptySet(), 20, profile)
        val typo = repository.structured("pub", query("Button.Primry"), emptySet(), 20, profile)
        val retry = repository.markdown("pub", query("состояние"), emptySet(), 20, profile)

        assertTrue(
            russian.any { it.channel.name == "RUSSIAN" && "состоянием" in it.snippet },
            "Russian morphology/snippet results: $russian",
        )
        assertTrue(english.any { it.channel.name == "ENGLISH" })
        assertTrue(russian.none { "<script>" in it.snippet })
        assertTrue(russian.all { it.snippet.codePointCount(0, it.snippet.length) <= profile.snippetLength + 2 })
        assertTrue(typo.any { it.match == StructuredMatchKind.TRIGRAM })
        assertTrue(repository.structured("pub", query("Btt"), emptySet(), 20, profile).isEmpty())
        assertEquals(russian.map { it.kbUrl to it.channel }, retry.map { it.kbUrl to it.channel })
    }

    @Test
    fun `component title suffix dominates body frequency and technical camel case is searchable`() = runBlocking {
        if (url == null) return@runBlocking
        sql(
            """
                UPDATE documentation_pages SET title = 'Other' WHERE id = 'page';
                UPDATE knowledge_chunks
                SET page_title = 'Other', search_text = 'unrelated', code_text = ''
                WHERE id = 'chunk';
                INSERT INTO documentation_pages (id, publication_id, path, title, subjects) VALUES
                    ('page-basic-button', 'pub', 'components/BasicButtonUsage.md', 'BasicButton', '[]'),
                    ('page-button-group', 'pub', 'components/ButtonGroupUsage.md', 'ButtonGroup', '[]'),
                    ('page-ai-input', 'pub', 'components/AiInputUsage.md', 'AiInput', '[]');
                INSERT INTO documentation_content (
                    id, publication_id, page_id, source_path, source, ordinal, storage_key, sha256, size
                ) VALUES
                    ('content-basic-button', 'pub', 'page-basic-button', 'components/BasicButtonUsage.md', 'core', 0,
                        'basic', '${"1".repeat(64)}', 10),
                    ('content-button-group', 'pub', 'page-button-group', 'components/ButtonGroupUsage.md', 'core', 0,
                        'group', '${"2".repeat(64)}', 10),
                    ('content-ai-input', 'pub', 'page-ai-input', 'components/AiInputUsage.md', 'core', 0,
                        'input', '${"3".repeat(64)}', 10);
                INSERT INTO knowledge_chunks (
                    id, publication_id, page_id, content_id, source_path, ordinal, heading_path,
                    page_title, markdown, search_text, code_text, subjects, approximate_size, kb_url
                ) VALUES
                    ('chunk-basic-button', 'pub', 'page-basic-button', 'content-basic-button',
                        'components/BasicButtonUsage.md', 0, '["Style Button"]', 'BasicButton', '# Button',
                        'Документация компонента Button', 'Button()', '[]', 10, 'kb://basic-button'),
                    ('chunk-button-group', 'pub', 'page-button-group', 'content-button-group',
                        'components/ButtonGroupUsage.md', 0, '["Group"]', 'ButtonGroup', '# Group',
                        'Button Button Button Button Button', 'ButtonGroup { Button() }', '[]', 10, 'kb://button-group'),
                    ('chunk-ai-input', 'pub', 'page-ai-input', 'content-ai-input',
                        'components/AiInputUsage.md', 0, '["Modes"]', 'AiInput', '# Modes',
                        'Режим задаётся через AiInputStyle.mode', 'AiInputStyle.mode', '[]', 10, 'kb://ai-input');
            """.trimIndent(),
        )

        val useCase = SearchDocumentationUseCase(repository, repository)
        val request = DocumentationSearchRequest("project-a", "ds", "1", "compose", "Button", limit = 10)
        val result = assertIs<DocumentationSearchOutcome.Found>(useCase.execute(request))
        val markdown = result.page.items.filterIsInstance<DocumentationSearchResultDto.Markdown>()
        val technical = repository.markdown("pub", query("AiInputStyle.mode"), emptySet(), 20, profile)

        assertEquals("kb://basic-button", markdown.first().kbUrl)
        assertEquals("title-token-suffix", markdown.first().matchType)
        assertTrue(technical.any { it.kbUrl == "kb://ai-input" })
        assertTrue(technical.any { it.titleMatch == MarkdownTitleMatch.NONE })
    }

    private fun seed() {
        sql(
            """
            INSERT INTO documentation_bundles (
                id, project_id, design_system_id, design_system_version, platform, schema_version,
                storage_bucket, storage_key, sha256, compressed_size, uncompressed_size,
                manifest_json, actor_type, actor_id, uploaded_at
            ) VALUES ('bundle', 'project-a', 'ds', '1', 'compose', '1', 'bucket', 'raw/bundle',
                '${"0".repeat(64)}', 1, 1, '{}', 'user', 'user', now());
            INSERT INTO documentation_publications (
                id, project_id, bundle_id, design_system_id, design_system_version, platform,
                status, created_at, published_at
            ) VALUES ('pub', 'project-a', 'bundle', 'ds', '1', 'compose', 'published', now(), now());
            INSERT INTO active_documentation_publications (
                project_id, design_system_id, design_system_version, platform, publication_id, activated_at
            ) VALUES ('project-a', 'ds', '1', 'compose', 'pub', now());
            INSERT INTO documentation_pages (id, publication_id, path, title, subjects)
            VALUES ('page', 'pub', 'components/button', 'Button', '["components.button"]');
            INSERT INTO documentation_content (
                id, publication_id, page_id, source_path, source, ordinal, storage_key, sha256, size
            ) VALUES ('content', 'pub', 'page', 'docs/button.md', 'core', 0, 'object', '${"0".repeat(64)}', 8);
            INSERT INTO structured_artifacts (id, publication_id, type, format, storage_key, sha256, size)
            VALUES ('artifact', 'pub', 'components-info', 'compose-v1', 'artifact', '${"0".repeat(64)}', 1);
            INSERT INTO code_bindings (
                id, structured_artifact_id, publication_id, subject, kind, name, platform,
                platform_payload, technical_projection
            ) VALUES ('binding', 'artifact', 'pub', 'components.button', 'component-style', 'Button',
                'compose', '{}', 'Button.Primary');
            INSERT INTO structured_lookup_terms (
                id, code_binding_id, publication_id, original, normalized, tokenized, category
            ) VALUES ('term', 'binding', 'pub', 'Button.Primary', 'button.primary', 'button primary', 'reference');
            INSERT INTO knowledge_chunks (
                id, publication_id, page_id, content_id, source_path, ordinal, heading_path,
                page_title, markdown, search_text, code_text, subjects, approximate_size, kb_url
            ) VALUES ('chunk', 'pub', 'page', 'content', 'docs/button.md', 0, '["Button"]',
                'Button', '# Button', 'Русская кнопка Button', 'Button.Primary',
                '["components.button"]', 8, 'dsb://documentation/pub/content/0');
            """.trimIndent(),
        )
    }

    private fun sql(statement: String) = connection().use { connection ->
        connection.createStatement().use { it.execute(statement) }
    }

    private fun queryPlan(statement: String): String = connection().use { connection ->
        connection.createStatement().use { sql ->
            sql.executeQuery(statement).use { rows ->
                buildList {
                    while (rows.next()) add(rows.getString(1))
                }.joinToString("\n")
            }
        }
    }

    private fun connection() = DriverManager.getConnection(url, user, password)

    private fun query(raw: String) = requireNotNull(LexicalSearchQuery.from(raw))

    private val profile = LexicalRankingProfile()

    companion object {
        private const val TEST_DATABASE_URL = "DOCUMENTATION_TEST_DATABASE_URL"
        private const val TEST_DATABASE_USER = "DOCUMENTATION_TEST_DATABASE_USER"
        private const val TEST_DATABASE_PASSWORD = "DOCUMENTATION_TEST_DATABASE_PASSWORD"
        private const val POSTGRES_DRIVER = "org.postgresql.Driver"
    }
}

private fun requireTestDatabase(url: String) {
    val databaseName = url.substringAfterLast('/').substringBefore('?')
    require(databaseName.endsWith("_test")) {
        "DOCUMENTATION_TEST_DATABASE_URL must reference a dedicated database whose name ends with _test"
    }
}
