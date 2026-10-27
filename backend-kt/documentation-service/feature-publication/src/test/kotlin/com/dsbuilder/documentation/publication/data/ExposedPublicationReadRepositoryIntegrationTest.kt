package com.dsbuilder.documentation.publication.data

import com.dsbuilder.documentation.publication.application.BindingQuery
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.v1.jdbc.Database
import java.sql.DriverManager
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

class ExposedPublicationReadRepositoryIntegrationTest {
    private val url = System.getenv("DOCUMENTATION_TEST_DATABASE_URL")?.also(::requireTestDatabase)
    private val user = System.getenv("DOCUMENTATION_TEST_DATABASE_USER") ?: "documentation"
    private val password = System.getenv("DOCUMENTATION_TEST_DATABASE_PASSWORD") ?: "documentation"
    private val repository by lazy {
        ExposedPublicationReadRepository(Database.connect(requireNotNull(url), "org.postgresql.Driver", user, password))
    }

    @BeforeTest
    fun prepare() {
        if (url == null) return
        sql("TRUNCATE documentation_bundles CASCADE")
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
                INSERT INTO structured_artifacts (id, publication_id, type, format, storage_key, sha256, size)
                VALUES ('artifact', 'pub', 'components-info', 'compose-v1', 'artifact', '${"0".repeat(64)}', 1);
                INSERT INTO code_bindings (
                    id, structured_artifact_id, publication_id, subject, kind, name, platform,
                    platform_payload, technical_projection
                ) VALUES
                    ('binding-upper', 'artifact', 'pub', 'components.upper', 'component-style', 'Avatar',
                        'compose', '{}', 'Avatar'),
                    ('binding-lower', 'artifact', 'pub', 'components.lower', 'component-style', 'avatar',
                        'compose', '{}', 'avatar');
            """.trimIndent(),
        )
    }

    @AfterTest
    fun cleanup() {
        if (url != null) sql("TRUNCATE documentation_bundles CASCADE")
    }

    @Test
    fun exactNameIsCaseSensitiveWhileLegacyNameRemainsCaseInsensitive() = runBlocking {
        if (url == null) return@runBlocking

        val exact = repository.bindings("project-a", "pub", BindingQuery(null, null, null, null, 20, "Avatar"))
        val legacy = repository.bindings("project-a", "pub", BindingQuery(null, null, null, "AVATAR", 20))

        assertEquals(listOf("binding-upper"), exact?.items?.map { it.id })
        assertEquals(listOf("binding-lower", "binding-upper"), legacy?.items?.map { it.id })
    }

    private fun sql(statement: String) {
        DriverManager.getConnection(url, user, password).use { connection ->
            connection.createStatement().use { it.execute(statement) }
        }
    }
}

private fun requireTestDatabase(url: String) {
    require(url.substringAfterLast('/').substringBefore('?').endsWith("_test")) {
        "DOCUMENTATION_TEST_DATABASE_URL must reference a dedicated database whose name ends with _test"
    }
}
