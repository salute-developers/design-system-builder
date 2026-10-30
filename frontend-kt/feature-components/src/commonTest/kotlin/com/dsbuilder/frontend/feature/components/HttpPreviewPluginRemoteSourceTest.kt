package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.TargetPlatform
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.MultipartFile
import com.dsbuilder.frontend.feature.components.application.PreviewPluginArchive
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishPreviewPluginRemoteResult
import com.dsbuilder.frontend.feature.components.data.HttpPreviewPluginRemoteSource
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaComponent
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaManifest
import com.dsbuilder.frontend.feature.components.domain.apimeta.ApiMetaProperty
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class HttpPreviewPluginRemoteSourceTest {
    private val uploads = mutableListOf<Pair<String, List<MultipartFile>>>()
    private var answer = AuthenticatedHttpResponse(200, OK_BODY)
    private var failure: Exception? = null

    private val factory = object : AuthenticatedHttpClientFactory {
        override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = client()

        override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient = client()

        private fun client() = object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult = error("unused")

            override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("unused")

            override suspend fun postMultipart(path: String, files: List<MultipartFile>): AuthenticatedHttpResponse {
                failure?.let { throw it }
                uploads += path to files
                return answer
            }
        }
    }

    private fun command(dryRun: Boolean, platform: TargetPlatform) = PublishPreviewPluginRemoteCommand(
        platform = platform,
        apiUrl = ProjectApiUrl("https://api.test"),
        credential = BackendCredential.ServiceToken("t"),
        archive = PreviewPluginArchive("/work/plugin.zip", byteArrayOf(9, 8, 7), "{}", "[]".encodeToByteArray()),
        manifest = ApiMetaManifest(
            listOf(
                ApiMetaComponent(
                    "Avatar",
                    listOf(ApiMetaProperty("shape", "shape", listOf("shape"), null)),
                    listOf("hovered"),
                ),
            ),
        ),
        source = "api-meta.json",
        dryRun = dryRun,
    )

    private suspend fun publish(dryRun: Boolean = true, platform: TargetPlatform = TargetPlatform.COMPOSE) =
        HttpPreviewPluginRemoteSource(factory).publish(command(dryRun, platform))

    @Test
    fun sendsTheArchiveAndTheMetaAsTwoPartsOfOneRequestWithTheDryRunQuery() = runTest {
        val result = publish(dryRun = true)

        assertIs<PublishPreviewPluginRemoteResult.Published>(result)
        val (path, files) = uploads.single()
        assertEquals("/api/admin/compose-preview/plugin-builds?dryRun=true", path)
        assertEquals(listOf("plugin", "meta"), files.map { it.partName })
        assertEquals("preview-compose-plugin.zip", files[0].fileName)
        assertEquals("application/zip", files[0].contentType)
        assertEquals(listOf<Byte>(9, 8, 7), files[0].bytes.toList())
        val meta = Json.parseToJsonElement(files[1].bytes.decodeToString()).jsonObject
        assertEquals("compose", meta.getValue("platform").jsonPrimitive.content)
        assertTrue("designSystemId" !in meta)
    }

    @Test
    fun applyUsesDryRunFalse() = runTest {
        publish(dryRun = false)

        assertEquals("/api/admin/compose-preview/plugin-builds?dryRun=false", uploads.single().first)
    }

    @Test
    fun parsesTheOutcomeTheBuildAndTheReport() = runTest {
        val published = assertIs<PublishPreviewPluginRemoteResult.Published>(publish())

        assertEquals("published", published.outcome)
        assertEquals("0123456789ab", published.buildId)
        assertEquals("0.55.0", published.libraryVersion)
        assertEquals("https://plugins.test/builds/0123456789ab/", published.pluginUrl)
        assertEquals(2, published.report.createdProperties)
    }

    @Test
    fun aWebPluginGoesToTheWebRouteWithTheWebMeta() = runTest {
        answer = AuthenticatedHttpResponse(200, WEB_OK_BODY)

        val published = assertIs<PublishPreviewPluginRemoteResult.Published>(
            publish(dryRun = false, platform = TargetPlatform.REACT),
        )

        val (path, files) = uploads.single()
        assertEquals("/api/admin/web-preview/plugin-builds?dryRun=false", path)
        assertEquals(listOf("plugin", "meta"), files.map { it.partName })
        assertEquals("preview-web-plugin.zip", files[0].fileName)
        val meta = Json.parseToJsonElement(files[1].bytes.decodeToString()).jsonObject
        assertEquals("web", meta.getValue("platform").jsonPrimitive.content)
        assertEquals("0.384.0", published.libraryVersion)
        assertEquals("https://plugins.test/web/builds/0a1b2c3d4e5f/", published.pluginUrl)
    }

    @Test
    fun aPlatformWithoutARouteIsRefusedWithoutARequest() = runTest {
        assertIs<PublishPreviewPluginRemoteResult.Failed>(publish(platform = TargetPlatform.SWIFT_UI))

        assertTrue(uploads.isEmpty())
    }

    @Test
    fun aSuccessWithoutTheLibraryVersionIsUnreadable() = runTest {
        answer = AuthenticatedHttpResponse(200, OK_BODY.replace("uikitComposeVersion", "otherVersion"))

        val failed = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())

        assertTrue(failed.message.contains("unreadable"), failed.message)
    }

    @Test
    fun aConflictCarriesTheMessageOfTheBackend() = runTest {
        answer = AuthenticatedHttpResponse(409, """{"error":"BUILD_CONTENT_CHANGED","message":"Build changed"}""")

        val conflict = assertIs<PublishPreviewPluginRemoteResult.Conflict>(publish())

        assertEquals("Build changed", conflict.message)
    }

    @Test
    fun refusalsShowTheReasonOfTheServer() = runTest {
        answer = AuthenticatedHttpResponse(403, """{"error":"Forbidden"}""")
        val forbidden = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())
        answer = AuthenticatedHttpResponse(401, "{}")
        val unauthorized = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())
        answer = AuthenticatedHttpResponse(400, """{"error":"PLUGIN_META_SHA256_MISMATCH","message":"sha mismatch"}""")
        val bad = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())
        answer = AuthenticatedHttpResponse(503, """{"error":"Dependency unavailable"}""")
        val unavailable = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())

        assertTrue(forbidden.message.contains("forbidden"), forbidden.message)
        assertTrue(forbidden.message.contains("Forbidden"), forbidden.message)
        assertTrue(unauthorized.message.contains("unauthorized"), unauthorized.message)
        assertTrue(bad.message.contains("400") && bad.message.contains("sha mismatch"), bad.message)
        assertTrue(unavailable.message.contains("503"), unavailable.message)
    }

    @Test
    fun anUnreadableSuccessAnswerAndATransportFailureAreDeterministicFailures() = runTest {
        answer = AuthenticatedHttpResponse(200, "not json")
        val unreadable = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())
        failure = RuntimeException("connection refused\nsecond line")
        val transport = assertIs<PublishPreviewPluginRemoteResult.Failed>(publish())

        assertTrue(unreadable.message.contains("unreadable"), unreadable.message)
        assertTrue(transport.message.contains("unreachable") && transport.message.contains("connection refused"))
        assertTrue(!transport.message.contains("second line"), transport.message)
    }

    private companion object {
        const val OK_BODY = """{"outcome":"published","dryRun":true,"buildId":"0123456789ab",
            "uikitComposeVersion":"0.55.0",
            "metaSha256":"x","pluginUrl":"https://plugins.test/builds/0123456789ab/",
            "report":{"createdComponents":1,"createdProperties":2,"createdStates":0,"createdAliases":0,
            "unchangedProperties":0,"deprecatedMarked":0,"deprecatedMessageChanged":0,"deprecatedCleared":0,
            "rejected":[],"typeMismatches":[],"absent":[]}}"""
        const val WEB_OK_BODY = """{"outcome":"published","dryRun":false,"buildId":"0a1b2c3d4e5f",
            "platform":"web","libraryVersion":"0.384.0",
            "metaSha256":"x","pluginUrl":"https://plugins.test/web/builds/0a1b2c3d4e5f/",
            "report":{"createdComponents":1,"createdProperties":2,"createdStates":0,"createdAliases":0,
            "unchangedProperties":0,"deprecatedMarked":0,"deprecatedMessageChanged":0,"deprecatedCleared":0,
            "rejected":[],"typeMismatches":[],"absent":[]}}"""
    }
}
