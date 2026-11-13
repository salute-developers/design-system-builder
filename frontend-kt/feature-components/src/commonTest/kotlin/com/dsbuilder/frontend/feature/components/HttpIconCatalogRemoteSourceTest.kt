package com.dsbuilder.frontend.feature.components

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResponse
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.components.application.IconInUse
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteCommand
import com.dsbuilder.frontend.feature.components.application.PublishIconCatalogRemoteResult
import com.dsbuilder.frontend.feature.components.data.HttpIconCatalogRemoteSource
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestEntry
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestSource
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class HttpIconCatalogRemoteSourceTest {
    private val posts = mutableListOf<Pair<String, String>>()
    private var answer = AuthenticatedHttpResponse(200, OK_BODY)
    private var failure: Exception? = null

    private val factory = object : AuthenticatedHttpClientFactory {
        override fun create(apiUrl: String, apiKey: String): AuthenticatedHttpClient = client()

        override fun create(apiUrl: String, credential: BackendCredential): AuthenticatedHttpClient = client()

        private fun client() = object : AuthenticatedHttpClient {
            override suspend fun get(path: String): AuthenticatedHttpResult = error("unused")

            override suspend fun post(path: String, body: String): AuthenticatedHttpResult = error("unused")

            override suspend fun postJson(path: String, body: String): AuthenticatedHttpResponse {
                failure?.let { throw it }
                posts += path to body
                return answer
            }
        }
    }

    private val manifest = IconManifest(
        IconManifestSource("@salutejs/sdds-icons", "0.14.0"),
        listOf(
            IconManifestEntry("AddOutline", "Actions & Feedback", listOf("add", "добавить"), mapOf(16 to "<svg/>")),
            IconManifestEntry("NewFill", null, emptyList(), mapOf(24 to "<svg/>")),
        ),
    )

    private suspend fun publish(dryRun: Boolean = true, allowRemovingUsed: Boolean = false) =
        HttpIconCatalogRemoteSource(factory).publish(
            PublishIconCatalogRemoteCommand(
                apiUrl = ProjectApiUrl("https://api.test"),
                credential = BackendCredential.ServiceToken("t"),
                manifest = manifest,
                dryRun = dryRun,
                allowRemovingUsed = allowRemovingUsed,
            ),
        )

    private fun failed(result: PublishIconCatalogRemoteResult) =
        assertIs<PublishIconCatalogRemoteResult.Failed>(result).message

    @Test
    fun postsTheManifestAsJsonWithTheQueryFlags() = runTest {
        val result = publish(dryRun = true, allowRemovingUsed = true)

        assertIs<PublishIconCatalogRemoteResult.Published>(result)
        val (path, body) = posts.single()
        assertEquals("/api/admin/icons/catalog?dryRun=true&allowRemovingUsed=true", path)
        val root = Json.parseToJsonElement(body).jsonObject
        assertEquals("1", root.getValue("schemaVersion").jsonPrimitive.content)
        assertEquals(
            "@salutejs/sdds-icons",
            root.getValue("source").jsonObject.getValue("package").jsonPrimitive.content,
        )
        val icons = root.getValue("icons").jsonArray
        assertEquals("Actions & Feedback", icons[0].jsonObject.getValue("category").jsonPrimitive.content)
        assertEquals("<svg/>", icons[0].jsonObject.getValue("sizes").jsonObject.getValue("16").jsonPrimitive.content)
        assertTrue("category" !in icons[1].jsonObject)
    }

    @Test
    fun applyUsesDryRunFalse() = runTest {
        publish(dryRun = false)

        assertEquals("/api/admin/icons/catalog?dryRun=false&allowRemovingUsed=false", posts.single().first)
    }

    @Test
    fun readsTheReport() = runTest {
        val report = assertIs<PublishIconCatalogRemoteResult.Published>(publish()).report

        assertEquals("published", report.outcome)
        assertEquals("3fa9c01d27be", report.loadId)
        assertEquals(12, report.counts.added)
        assertEquals(listOf("A", "B"), report.added)
        assertEquals(listOf(IconInUse("OldFill", listOf(16), 4)), report.removedInUse)
        assertEquals(1, report.reconciliation.unresolved)
        assertEquals(listOf("chevron.left.24"), report.reconciliation.unresolvedValues)
    }

    @Test
    fun anInUseConflictListsTheIcons() = runTest {
        answer = AuthenticatedHttpResponse(
            409,
            """{"error":"Conflict","code":"icons_in_use","message":"icons_in_use",""" +
                """"details":{"removedInUse":[{"name":"OldFill","sizes":[16,24],"references":4}]}}""",
        )

        val result = assertIs<PublishIconCatalogRemoteResult.InUse>(publish())

        assertEquals(listOf(IconInUse("OldFill", listOf(16, 24), 4)), result.items)
    }

    @Test
    fun anotherConflictIsAPlainFailure() = runTest {
        answer = AuthenticatedHttpResponse(409, """{"error":"Conflict","code":"other","message":"Something else"}""")

        assertEquals("Something else", failed(publish()))
    }

    @Test
    fun mapsTheBackendErrors() = runTest {
        answer = AuthenticatedHttpResponse(403, """{"error":"Forbidden"}""")
        assertTrue(failed(publish()).contains("no right to publish the icon catalog"))
        answer = AuthenticatedHttpResponse(401, "")
        assertTrue(failed(publish()).startsWith("Status: unauthorized"))
        answer = AuthenticatedHttpResponse(413, "")
        assertTrue(failed(publish()).startsWith("Status: payload too large"))
        answer = AuthenticatedHttpResponse(503, "")
        assertTrue(failed(publish()).startsWith("Status: unavailable"))
        answer = AuthenticatedHttpResponse(400, """{"error":"Bad Request","message":"unsafe_svg"}""")
        assertTrue(failed(publish()).contains("unsafe_svg"))
        answer = AuthenticatedHttpResponse(500, "boom")
        assertTrue(failed(publish()).contains("HTTP 500"))
    }

    @Test
    fun anUnreadableSuccessBodyIsAFailure() = runTest {
        answer = AuthenticatedHttpResponse(200, "[]")

        assertTrue(failed(publish()).contains("unreadable catalog report"))
    }

    @Test
    fun anUnreachableBackendIsAFailureNotACrash() = runTest {
        failure = IllegalStateException("connection refused\nstack")

        assertEquals("Status: failed. Backend is unreachable: connection refused", failed(publish()))
    }

    private companion object {
        const val OK_BODY = """{"outcome":"published","dryRun":false,"loadId":"3fa9c01d27be",
            "counts":{"added":12,"removed":1,"changed":3,"unchanged":1430},
            "added":["A","B"],"removed":[],"changed":[],"truncated":false,
            "removedInUse":[{"name":"OldFill","sizes":[16],"references":4}],
            "reconciliation":{"resolved":118,"unresolved":1,"unresolvedValues":["chevron.left.24"]}}"""
    }
}
