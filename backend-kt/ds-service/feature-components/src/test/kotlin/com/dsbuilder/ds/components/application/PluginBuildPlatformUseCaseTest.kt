package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import com.dsbuilder.ds.components.domain.NewPluginBuild
import com.dsbuilder.ds.components.domain.PluginBuild
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import kotlinx.coroutines.runBlocking
import java.io.ByteArrayOutputStream
import java.time.Duration
import java.time.Instant
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Публикация и выдача билдов по платформам (change publish-web-preview-plugin): платформы не мешают друг другу. */
class PluginBuildPlatformUseCaseTest {
    private val builds = InMemoryBuilds()
    private val metaImports = mutableListOf<ImportApiMeta>()
    private val composeStorage = InMemoryStorage()
    private val webStorage = InMemoryStorage()

    private fun storages(web: PluginBuildStorage = webStorage, keepBuilds: Int = 5) = PluginBuildStorages(
        mapOf(
            PreviewPluginPlatform.COMPOSE to
                PluginBuildStorageBinding(composeStorage, settings(COMPOSE_BASE, keepBuilds)),
            PreviewPluginPlatform.WEB to PluginBuildStorageBinding(web, settings(WEB_BASE, keepBuilds)),
        ),
    )

    private fun settings(base: String, keepBuilds: Int) =
        PluginBuildSettings(publicBaseUrl = base, keepBuilds = keepBuilds, orphanGrace = Duration.ofHours(1))

    private fun publisher(storages: PluginBuildStorages = storages()) =
        PublishPluginBuildUseCase(ImmediateTransactions, storages, builds, RecordingApiMeta(metaImports))

    private fun active(storages: PluginBuildStorages = storages()) = GetActivePluginBuildUseCase(
        DsAccessPolicy(PolicyEvaluator(AuthorizationPolicyLoader.loadEmbedded())),
        ImmediateTransactions,
        storages,
        builds,
    )

    private suspend fun publish(
        platform: PreviewPluginPlatform,
        commit: String,
        metaPlatform: String = platform.wire,
        storages: PluginBuildStorages = storages(),
    ) = publisher(storages).execute(
        platform,
        PUBLISHER,
        PublishPluginBuild(archive(platform, commit), meta(metaPlatform), dryRun = false),
    )

    @Test
    fun `a web build is published into the web storage and imports the web meta`() = runBlocking<Unit> {
        val result = assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.WEB, COMMIT_A))

        assertEquals(PublishKind.PUBLISHED, result.value.kind)
        assertEquals("web", result.value.build.platform)
        assertEquals("0.386.0", result.value.build.libraryVersion)
        assertEquals("$WEB_BASE/builds/${COMMIT_A.take(12)}/", result.value.pluginUrl)
        assertTrue(webStorage.files.keys.all { it.startsWith("${COMMIT_A.take(12)}/") })
        assertTrue(webStorage.files.isNotEmpty())
        assertTrue(composeStorage.files.isEmpty())
        assertEquals(listOf("web"), metaImports.map { it.platform })
        assertEquals(false, metaImports.single().dryRun)
    }

    @Test
    fun `meta of another platform is refused before anything is written`() = runBlocking<Unit> {
        val result = assertIs<DsResult.Failure>(publish(PreviewPluginPlatform.WEB, COMMIT_A, metaPlatform = "compose"))

        assertEquals(DsFailure.InvalidRequest(PublishPluginBuildUseCase.INVALID_BODY), result.error)
        assertTrue(webStorage.files.isEmpty())
        assertTrue(builds.rows.isEmpty())
        assertTrue(metaImports.isEmpty())
    }

    @Test
    fun `a build id taken by another platform is a conflict`() = runBlocking<Unit> {
        assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.COMPOSE, COMMIT_A))
        metaImports.clear()

        val result = assertIs<DsResult.Failure>(publish(PreviewPluginPlatform.WEB, COMMIT_A))

        val conflict = assertIs<DsFailure.Conflict>(result.error)
        assertEquals(PublishPluginBuildUseCase.BUILD_PLATFORM_CONFLICT, conflict.code)
        assertTrue(webStorage.files.isEmpty())
        assertEquals("compose", builds.rows.getValue(COMMIT_A.take(12)).platform)
        assertTrue(metaImports.isEmpty())
        // a dry run reports the same conflict
        val dryRun = publisher().execute(
            PreviewPluginPlatform.WEB,
            PUBLISHER,
            PublishPluginBuild(archive(PreviewPluginPlatform.WEB, COMMIT_A), meta("web"), dryRun = true),
        )
        assertIs<DsFailure.Conflict>(assertIs<DsResult.Failure>(dryRun).error)
    }

    @Test
    fun `the cleanup of one platform keeps the builds and files of the other`() = runBlocking<Unit> {
        val storages = storages(keepBuilds = 0)
        composeStorage.preload("composeorph1", Instant.now().minus(Duration.ofDays(3)))
        webStorage.preload("weborphan001", Instant.now().minus(Duration.ofDays(3)))
        assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.COMPOSE, COMMIT_A, storages = storages))
        composeStorage.preload("composeorph2", Instant.now().minus(Duration.ofDays(3)))
        val composeFiles = composeStorage.files.keys.toSet()

        assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.WEB, COMMIT_B, storages = storages))
        assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.WEB, COMMIT_C, storages = storages))

        // web keeps only its active build and loses its orphan
        assertEquals(setOf(COMMIT_C.take(12)), webStorage.files.keys.map { it.substringBefore('/') }.toSet())
        // the Compose build, its files and even its own orphan stay: the web cleanup never sees them
        assertEquals(composeFiles, composeStorage.files.keys)
        assertEquals(
            setOf(COMMIT_A.take(12) to "compose", COMMIT_C.take(12) to "web"),
            builds.rows.values.map { it.buildId to it.platform }.toSet(),
        )
        assertTrue(builds.rows.values.all { it.active })
    }

    @Test
    fun `publication without the storage of its platform is unavailable`() = runBlocking<Unit> {
        val storages = storages(web = UnconfiguredStorage)

        val web = assertIs<DsResult.Failure>(publish(PreviewPluginPlatform.WEB, COMMIT_B, storages = storages))
        assertEquals(DsFailure.DependencyUnavailable("web-preview-storage"), web.error)
        assertIs<DsResult.Success<PublishResult>>(publish(PreviewPluginPlatform.COMPOSE, COMMIT_A, storages = storages))
    }

    @Test
    fun `the active build is served per platform`() = runBlocking<Unit> {
        assertEquals(DsFailure.NotFound, notFound(active().execute(PreviewPluginPlatform.WEB, USER)))
        publish(PreviewPluginPlatform.COMPOSE, COMMIT_A)
        assertEquals(DsFailure.NotFound, notFound(active().execute(PreviewPluginPlatform.WEB, USER)))
        publish(PreviewPluginPlatform.WEB, COMMIT_B)

        val compose = assertIs<DsResult.Success<ActivePluginBuild>>(
            active().execute(PreviewPluginPlatform.COMPOSE, USER),
        )
        val web = assertIs<DsResult.Success<ActivePluginBuild>>(active().execute(PreviewPluginPlatform.WEB, USER))
        assertEquals(COMMIT_A.take(12), compose.value.build.buildId)
        assertEquals("$COMPOSE_BASE/builds/${COMMIT_A.take(12)}/", compose.value.pluginUrl)
        assertEquals(COMMIT_B.take(12), web.value.build.buildId)
        assertEquals("$WEB_BASE/builds/${COMMIT_B.take(12)}/", web.value.pluginUrl)

        // without the web storage the address is not served even though a web build is registered
        val withoutWeb = active(storages(web = UnconfiguredStorage)).execute(PreviewPluginPlatform.WEB, USER)
        assertEquals(DsFailure.NotFound, notFound(withoutWeb))
    }

    private fun notFound(result: DsResult<ActivePluginBuild>) = assertIs<DsResult.Failure>(result).error

    // ── fixtures ──────────────────────────────────────────────────────────────────────────

    private fun meta(platform: String) = ImportApiMeta(
        platform = platform,
        source = "api-meta.json",
        dryRun = true,
        components = emptyList(),
    )

    private fun archive(platform: PreviewPluginPlatform, commit: String): ByteArray {
        val meta = """[{"componentName":"Button"}]"""
        val library = if (platform == PreviewPluginPlatform.WEB) "0.386.0" else "0.55.0"
        val manifest = """{"schemaVersion":1,"platform":"${platform.wire}","protocolVersion":1,""" +
            """"entrypoint":"index.html","version":"${commit.take(12)}","commit":"$commit",""" +
            """"${platform.libraryVersionField}":"$library","apiMetaSha256":"${sha256Hex(meta.toByteArray())}"}"""
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            mapOf("index.html" to "<html/>", "preview-plugin.json" to manifest, "api-meta.json" to meta)
                .forEach { (path, content) ->
                    zip.putNextEntry(ZipEntry(path))
                    zip.write(content.toByteArray())
                    zip.closeEntry()
                }
        }
        return out.toByteArray()
    }

    private object ImmediateTransactions : TransactionRunner {
        override suspend fun <T> required(block: suspend () -> DsResult<T>) = block()
        override suspend fun <T> readOnly(block: suspend () -> DsResult<T>) = block()
    }

    private class RecordingApiMeta(private val imports: MutableList<ImportApiMeta>) : ApiMetaRepository {
        override suspend fun import(command: ImportApiMeta): ApiMetaRepository.ImportAttempt {
            imports += command
            return ApiMetaRepository.ImportAttempt.Success(ApiMetaImportReport())
        }
    }

    private class InMemoryBuilds : PluginBuildRepository {
        val rows = linkedMapOf<String, PluginBuild>()
        private var clock = Instant.parse("2026-10-01T00:00:00Z")

        override suspend fun lockPublications() = Unit

        override suspend fun find(buildId: String) = rows[buildId]

        override suspend fun active(platform: String) =
            rows.values.singleOrNull { it.platform == platform && it.active }

        override suspend fun listByRecency(platform: String) =
            rows.values.filter { it.platform == platform }.sortedByDescending { it.publishedAt }

        override suspend fun insertActive(build: NewPluginBuild): PluginBuild {
            deactivate(build.platform)
            clock = clock.plusSeconds(1)
            return PluginBuild(
                buildId = build.buildId,
                platform = build.platform,
                libraryVersion = build.libraryVersion,
                metaSha256 = build.metaSha256,
                commit = build.commit,
                protocolVersion = build.protocolVersion,
                zipSha256 = build.zipSha256,
                sizeBytes = build.sizeBytes,
                fileCount = build.fileCount,
                publishedBy = build.publishedBy,
                publishedAt = clock,
                active = true,
            ).also { rows[it.buildId] = it }
        }

        override suspend fun activate(buildId: String): PluginBuild {
            val existing = rows.getValue(buildId)
            deactivate(existing.platform)
            return existing.copy(active = true).also { rows[buildId] = it }
        }

        override suspend fun delete(buildId: String) {
            rows.remove(buildId)
        }

        private fun deactivate(platform: String) {
            rows.replaceAll { _, build -> if (build.platform == platform) build.copy(active = false) else build }
        }
    }

    private class InMemoryStorage : PluginBuildStorage {
        val files = linkedMapOf<String, Instant>()

        override val configured = true

        fun preload(buildId: String, modified: Instant) {
            files["$buildId/index.html"] = modified
        }

        override suspend fun putFile(
            buildId: String,
            path: String,
            bytes: ByteArray,
            contentType: String,
            cacheControl: String,
        ) {
            files["$buildId/$path"] = Instant.now()
        }

        override suspend fun listBuilds() = files.entries.groupBy({ it.key.substringBefore('/') }, { it.value })
            .map { (id, times) -> StoredPluginBuild(id, times.max()) }

        override suspend fun deleteBuild(buildId: String) {
            files.keys.removeAll { it.startsWith("$buildId/") }
        }
    }

    private object UnconfiguredStorage : PluginBuildStorage {
        override val configured = false
        override suspend fun putFile(
            buildId: String,
            path: String,
            bytes: ByteArray,
            contentType: String,
            cacheControl: String,
        ) = error("not configured")

        override suspend fun listBuilds() = emptyList<StoredPluginBuild>()
        override suspend fun deleteBuild(buildId: String) = error("not configured")
    }

    private companion object {
        const val COMPOSE_BASE = "https://plugins.example.test/compose-preview"
        const val WEB_BASE = "https://plugins.example.test/web-preview"
        const val COMMIT_A = "aaaaaaaaaaaa1111111111111111111111111111"
        const val COMMIT_B = "bbbbbbbbbbbb2222222222222222222222222222"
        const val COMMIT_C = "cccccccccccc3333333333333333333333333333"

        val PUBLISHER = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "compose-publisher", "global", composePreviewPublisher = true),
            "correlation-1",
        )
        val USER = DsRequestContext(
            ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "owner"),
            "correlation-2",
        )
    }
}
