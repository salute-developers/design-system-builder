package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadRuntime
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class HttpModelReadRemoteSourceTest {
    @Test
    fun `filters and page size are sent to server without local truncation or name matching`() = runTest {
        var requested = ""
        val source = source { path ->
            requested = path
            success("""[{"id":"one","name":"server-result"}]""")
        }
        val result = source.read(
            runtime(),
            ModelReadCommand(
                ModelReadOperation.TOKENS,
                version = "draft",
                filters = mapOf("name" to "a b", "type" to "color"),
            ),
        )
        val value = assertIs<ModelReadResult.Success>(result).value.jsonObject
        assertTrue(requested.contains("name=a%20b"))
        assertTrue(requested.contains("type=color"))
        assertTrue(requested.contains("limit=50"))
        assertEquals(
            "server-result",
            value.getValue("items").jsonArray.single().jsonObject["name"]?.jsonPrimitive?.content,
        )
        assertEquals("next-page", value["nextCursor"]?.jsonPrimitive?.content)
    }

    @Test
    fun `model summaries retain every server item and only remove verbose fields`() = runTest {
        for (operation in listOf(ModelReadOperation.TOKENS, ModelReadOperation.COMPONENTS)) {
            val result = source {
                success(
                    """[
                      {"id":"one","name":"server-a","type":"color","platform":"web","createdAt":"now"},
                      {"id":"two","name":"server-b","type":"color","platform":"web","createdAt":"now"}
                    ]""",
                )
            }.read(runtime(), ModelReadCommand(operation, version = "draft", filters = mapOf("name" to "requested")))
            val items = assertIs<ModelReadResult.Success>(result).value.jsonObject.getValue("items").jsonArray
            assertEquals(listOf("one", "two"), items.map { it.jsonObject.getValue("id").jsonPrimitive.content })
            assertTrue(items.all { "createdAt" !in it.jsonObject })
            val expected = if (operation == ModelReadOperation.TOKENS) "type" else "platform"
            assertTrue(items.all { expected in it.jsonObject })
        }
    }

    @Test
    fun `token detail and values forward version and exact value selectors to ID routes`() = runTest {
        val paths = mutableListOf<String>()
        val source = source { path ->
            paths += path
            AuthenticatedHttpResult.Success("{}", mapOf("x-ds-read-context" to DRAFT_CONTEXT))
        }
        val filters = mapOf("tenantId" to ID, "mode" to "dark", "platform" to "android")
        for (operation in listOf(ModelReadOperation.TOKEN, ModelReadOperation.TOKEN_VALUES)) {
            val command = ModelReadCommand(
                operation,
                ID,
                "draft",
                if (operation == ModelReadOperation.TOKEN_VALUES) filters else emptyMap(),
            )
            assertIs<ModelReadResult.Success>(source.read(runtime(), command))
        }
        assertTrue(paths.first().endsWith("/tokens/$ID?version=draft"))
        val values = paths.last()
        assertTrue(values.contains("/tokens/$ID/values?"))
        for ((key, value) in filters + ("version" to "draft")) assertTrue(values.contains("$key=$value"))
    }

    @Test
    fun `missing or invalid metadata fails instead of reporting end of list`() = runTest {
        val bad = listOf(
            AuthenticatedHttpResult.Success("[]"),
            success("[]").copy(readHeadersValid = false),
            success("[]").copy(headers = mapOf("x-ds-read-context" to DRAFT_CONTEXT)),
            success("[]").copy(headers = mapOf("x-ds-page-limit" to "50")),
            success("[]").copy(headers = mapOf("x-ds-read-context" to "{}", "x-ds-page-limit" to "50")),
            success("[]").copy(headers = mapOf("x-ds-read-context" to DRAFT_CONTEXT, "x-ds-page-limit" to "0")),
            success("[]").copy(headers = mapOf("x-ds-read-context" to DRAFT_CONTEXT, "x-ds-page-limit" to "50.0")),
        )
        bad.forEach { response ->
            val result = source { response }.read(
                runtime(),
                ModelReadCommand(ModelReadOperation.TOKENS, version = "draft"),
            )
            assertEquals("BACKEND_UNAVAILABLE", assertIs<ModelReadResult.Failed>(result).code)
        }
    }

    @Test
    fun `final page has no cursor and unknown context fields never leak`() = runTest {
        val context = DRAFT_CONTEXT.dropLast(1) + ",\"Authorization\":\"secret\",\"internalUrl\":\"private\"}"
        val response = AuthenticatedHttpResult.Success(
            "[]",
            mapOf(
                "x-ds-read-context" to context,
                "x-ds-page-limit" to "50",
            ),
        )
        val result = source { response }.read(
            runtime(),
            ModelReadCommand(ModelReadOperation.TENANTS, version = "draft"),
        )
        val value = assertIs<ModelReadResult.Success>(result).value.jsonObject
        assertFalse("nextCursor" in value)
        assertFalse(value.toString().contains("secret"))
        assertFalse(value.toString().contains("private"))
    }

    @Test
    fun `HTTP failures preserve categories without exposing raw backend body`() = runTest {
        mapOf(
            400 to "INVALID_QUERY",
            401 to "AUTH_REQUIRED",
            403 to "FORBIDDEN",
            404 to "NOT_FOUND",
            503 to "BACKEND_UNAVAILABLE",
        )
            .forEach { (status, code) ->
                val result = source { AuthenticatedHttpResult.Failure("secret-value", status) }
                    .read(runtime(), ModelReadCommand(ModelReadOperation.TOKEN, ID, "draft"))
                val failure = assertIs<ModelReadResult.Failed>(result)
                assertEquals(code, failure.code)
                assertFalse(failure.message.contains("secret-value"))
            }
    }

    @Test
    fun `appearance ID is used directly and component metadata never inherits a version`() = runTest {
        val paths = mutableListOf<String>()
        val source = source { path ->
            paths += path
            if (path.contains("appearances/")) {
                AuthenticatedHttpResult.Success("[]", mapOf("x-ds-read-context" to DRAFT_CONTEXT))
            } else {
                AuthenticatedHttpResult.Success("{\"id\":\"$ID\"}")
            }
        }
        assertIs<ModelReadResult.Success>(
            source.read(
                runtime(),
                ModelReadCommand(
                    ModelReadOperation.APPEARANCE_VARIATIONS,
                    ID,
                    "draft",
                ),
            ),
        )
        assertIs<ModelReadResult.Success>(
            source.read(
                runtime(),
                ModelReadCommand(
                    ModelReadOperation.COMPONENT,
                    ID,
                    "1.2.3",
                ),
            ),
        )
        assertTrue(paths.first().contains("/appearances/$ID/variations?version=draft"))
        assertTrue(paths.last().endsWith("/components/$ID"))
    }

    private fun runtime() = ModelReadRuntime(
        ProjectContext(ProjectId("project"), DesignSystemId(ID), CredentialEnvName("KEY"), ""),
        "https://public.example.test",
        BackendCredential.ProjectKey("test-key"),
    )

    private fun source(response: (String) -> AuthenticatedHttpResult) = HttpModelReadRemoteSource(
        object : AuthenticatedHttpClientFactory {
            override fun create(
                apiUrl: String,
                apiKey: String,
            ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult = response(path)
                override suspend fun post(
                    path: String,
                    body: String,
                ): AuthenticatedHttpResult = error("Unexpected POST")
            }
        },
    )

    private fun success(body: String) = AuthenticatedHttpResult.Success(
        body,
        mapOf(
            "x-ds-read-context" to DRAFT_CONTEXT,
            "x-ds-page-limit" to "50",
            "x-ds-next-cursor" to "next-page",
        ),
    )

    private companion object {
        const val ID = "550e8400-e29b-41d4-a716-446655440000"
        val DRAFT_CONTEXT = """
            {
              "designSystemId": "550e8400-e29b-41d4-a716-446655440000",
              "version": "draft",
              "draftId": "550e8400-e29b-41d4-a716-446655440001",
              "draftRevision": 12
            }
        """.trimIndent()
    }
}
