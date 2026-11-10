package com.dsbuilder.frontend.mcpserver

import com.dsbuilder.frontend.core.application.ContextResolver
import com.dsbuilder.frontend.core.application.ContextSource
import com.dsbuilder.frontend.core.application.ContextSourceResult
import com.dsbuilder.frontend.core.application.CredentialProvider
import com.dsbuilder.frontend.core.application.CredentialResult
import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.auth.BackendCredentialType
import com.dsbuilder.frontend.core.domain.CredentialEnvName
import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.ProjectApiUrl
import com.dsbuilder.frontend.core.domain.ProjectContext
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.network.ApiUrlResolver
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.core.network.HttpMutationRequest
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.feature.components.componentsApplicationModule
import com.dsbuilder.frontend.feature.status.application.CheckProjectStatusResult
import com.dsbuilder.frontend.feature.theme.themeApplicationModule
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.koin.dsl.koinApplication
import org.koin.dsl.module
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class McpEditorToolsTest {
    @Test
    fun everyDeclaredMutationReachesOneScopedRequestAndBothSourceReadsWork() = runTest {
        val fixture = Fixture()
        for (tool in editorMcpToolDefinitions()) {
            val args = validArguments(tool)
            val before = fixture.writes.size
            val result = fixture.core.callTool(tool.name, args)
            assertFalse(result.isError, "${tool.name}: ${result.body}")
            assertEquals(
                if (tool.readOnly) before else before + 1,
                fixture.writes.size,
                tool.name,
            )
            if (!tool.readOnly) {
                val request = fixture.writes.last()
                assertTrue(
                    request.path.startsWith("/api/projects/project/design-systems/system/"),
                    tool.name,
                )
                assertEquals("key", request.idempotencyKey)
                val body = request.body?.let { Json.parseToJsonElement(it).jsonObject }
                assertFalse(body?.containsKey("designSystemId") == true)
            }
        }
        assertEquals(30, fixture.writes.size)
        assertEquals(32, editorMcpToolDefinitions().map { it.name }.distinct().size)
    }

    @Test
    fun valuesWithoutAModeCanBeCreatedWithAnExplicitNullKey() = runTest {
        val fixture = Fixture()
        val args = Json.parseToJsonElement(
            """{"tokenId":"t","tenantId":"theme","platform":"web","mode":null,"value":21,"idempotencyKey":"key"}""",
        ).jsonObject
        assertFalse(fixture.core.callTool("token_value_create", args).isError)
        val body = Json.parseToJsonElement(fixture.writes.single().body!!).jsonObject
        assertEquals(JsonNull, body.getValue("mode"))
        assertEquals(JsonPrimitive(21), body.getValue("value"))
    }

    @Test
    fun familyUpdateRejectsMissingDuplicateAndStaleShapePairsBeforeWriting() = runTest {
        val tool = editorTokenTools.single { it.name == "color_token_values_update" }
        val valid = validArguments(tool)
        val member = valid.getValue("members").jsonArray.single().jsonObject
        val pairs = member.getValue("values").jsonArray
        val fixture = Fixture()
        for (bad in listOf(
            JsonArray(pairs.dropLast(1)),
            JsonArray(pairs.dropLast(1) + pairs.first()),
        )) {
            val args = JsonObject(valid + ("members" to JsonArray(listOf(JsonObject(member + ("values" to bad))))))
            assertTrue(fixture.core.callTool(tool.name, args).isError)
        }
        assertTrue(fixture.writes.isEmpty())
        assertFalse(fixture.core.callTool(tool.name, valid).isError)
        assertEquals(1, fixture.writes.size)
        assertEquals(
            valid.getValue("members"),
            Json.parseToJsonElement(fixture.writes.single().body!!).jsonObject["members"],
        )
    }

    @Test
    fun partialUpdatesKeepExplicitNullAndPropertyBindingWhileRejectingUnknownFields() = runTest {
        val fixture = Fixture()
        val axis = Json.parseToJsonElement(
            """
{
  "axisId": "axis",
  "idempotencyKey": "key",
  "displayName": null,
  "isRoot": false
}
""",
        ).jsonObject
        assertFalse(fixture.core.callTool("component_axis_update", axis).isError)
        val axisBody = Json.parseToJsonElement(fixture.writes.last().body!!).jsonObject
        assertEquals(JsonNull, axisBody["displayName"])
        assertFalse("defaultStyleId" in axisBody)
        assertEquals(JsonPrimitive(false), axisBody["isRoot"])
        val property = Json.parseToJsonElement(
            """
{
  "appearanceId": "config",
  "propertyId": "p",
  "tokenId": "token",
  "idempotencyKey": "key"
}
""",
        ).jsonObject
        assertFalse(fixture.core.callTool("component_property_set", property).isError)
        assertEquals(
            JsonPrimitive("token"),
            Json.parseToJsonElement(fixture.writes.last().body!!).jsonObject["tokenId"],
        )
        val before = fixture.writes.size
        val reference = Json.parseToJsonElement("""{"targetAppearanceId":"a","admin":true}""")
        val invalid = JsonObject(property + ("reference" to reference))
        assertTrue(fixture.core.callTool("component_property_set", invalid).isError)
        assertEquals(before, fixture.writes.size)
    }

    @Test
    fun resetUsesQueryAndFamilyCreateKeepsPlacement() = runTest {
        val fixture = Fixture()
        val args = Json.parseToJsonElement(
            """
{
  "appearanceId": "a",
  "propertyId": "p",
  "styleIds": [
    "s1",
    "s2"
  ],
  "states": [
    "hover"
  ],
  "idempotencyKey": "key"
}
""",
        ).jsonObject
        assertFalse(fixture.core.callTool("component_property_reset", args).isError)
        assertTrue(fixture.writes.last().path.contains("propertyId=p&styleIds=s1%2Cs2&states=hover"))
        assertEquals(null, fixture.writes.last().body)
        val tool = editorTokenTools.single { it.name == "color_token_create" }
        val create = JsonObject(validArguments(tool) + ("groupId" to JsonPrimitive("group")))
        assertFalse(fixture.core.callTool(tool.name, create).isError)
        assertEquals(
            JsonPrimitive("group"),
            Json.parseToJsonElement(fixture.writes.last().body!!).jsonObject["groupId"],
        )
    }

    @Test
    fun publishedContextAndExplicitDraftUseOneResolvedContextPerCall() = runTest {
        val fixture = Fixture("1.0.0")
        val args = validArguments(editorTokenTools.single { it.name == "token_delete" })
        val denied = fixture.core.callTool("token_delete", args)
        assertEquals(
            "READ_ONLY_VERSION",
            Json.parseToJsonElement(denied.body).jsonObject["code"]?.jsonPrimitive?.content,
        )
        assertTrue(fixture.writes.isEmpty())
        val draft = JsonObject(args + ("version" to JsonPrimitive("draft")))
        assertFalse(fixture.core.callTool("token_delete", draft).isError)
        assertEquals(2, fixture.contextReads)
        assertEquals(1, fixture.writes.size)
    }

    @Test
    fun failureCategoriesUnknownOutcomeAndConfirmedInvalidResponsesRemainDistinct() = runTest {
        val fixture = Fixture()
        val args = validArguments(editorTokenTools.single { it.name == "token_delete" })
        val categories = mapOf(
            400 to "VALIDATION_FAILED",
            401 to "AUTH_REQUIRED",
            403 to "FORBIDDEN",
            404 to "NOT_FOUND",
            409 to "CONFLICT",
            422 to "VALIDATION_FAILED",
        )
        for ((status, expected) in categories) {
            fixture.result = HttpMutationResult.Response(
                status,
                """
{
  "code": "backend_code",
  "details": {
    "tokenId": "t",
    "password": "secret"
  }
}
""",
                emptyMap(),
                true,
            )
            val result = fixture.core.callTool("token_delete", args)
            assertEquals(
                expected,
                Json.parseToJsonElement(result.body).jsonObject["code"]?.jsonPrimitive?.content,
            )
            assertTrue(result.body.contains("backend_code"))
            assertFalse(result.body.contains("secret"))
        }
        fixture.result = HttpMutationResult.OutcomeUnknown("key")
        assertTrue(
            fixture.core.callTool(
                "token_delete",
                args,
            ).body.contains("OUTCOME_UNKNOWN"),
        )
        fixture.result = HttpMutationResult.Response(200, "broken json", emptyMap(), true)
        val confirmed = fixture.core.callTool("token_delete", args)
        assertFalse(confirmed.isError)
        assertTrue(confirmed.body.contains("\"confirmed\":true"))
        assertTrue(confirmed.body.contains("\"responseInvalid\":true"))
    }

    @Test
    fun sourceReadPreservesAuthoredValuesAndConfirmationFailurePreservesTheWrite() = runTest {
        val fixture = Fixture()
        val sourceTool = editorReadTools.single { it.name == "token_edit_data_get" }
        val source = fixture.core.callTool(sourceTool.name, validArguments(sourceTool))
        assertFalse(source.isError, source.body)
        val values = Json.parseToJsonElement(source.body).jsonObject.getValue("data")
            .jsonObject.getValue("values").jsonArray
        assertEquals(JsonPrimitive("palette.ref"), values.single().jsonObject["sourceValue"])
        assertEquals(JsonPrimitive(true), values.single().jsonObject["overridden"])
        assertEquals(1, fixture.contextReads)
        fixture.failReads = true
        fixture.result = HttpMutationResult.Response(
            200, "{}", mapOf("x-ds-mutation-metadata-truncated" to "true"), true,
        )
        val args = validArguments(editorTokenTools.single { it.name == "token_delete" })
        val result = fixture.core.callTool("token_delete", args)
        assertFalse(result.isError, result.body)
        val mutation = Json.parseToJsonElement(result.body).jsonObject.getValue("mutation").jsonObject
        assertEquals(JsonPrimitive(true), mutation["confirmed"])
        assertEquals(JsonPrimitive(true), mutation.getValue("confirmation").jsonObject["incomplete"])
    }

    @Test
    fun specializedUpdatesKeepPlatformOverridesAndSubjectRevisions() = runTest {
        val fixture = Fixture()
        val body = Json.parseToJsonElement(
            """
            {
              "tenantId":"t", "tokenId":"k", "valuePx":12,
              "platforms":{"ios":14}, "baseRevisions":{"web":7}, "idempotencyKey":"key"
            }
            """,
        ).jsonObject
        assertFalse(fixture.core.callTool("size_token_value_update", body).isError)
        val sent = Json.parseToJsonElement(fixture.writes.single().body!!).jsonObject
        assertEquals(body["platforms"], sent["platforms"])
        assertEquals(body["baseRevisions"], sent["baseRevisions"])
        assertFalse("tenantId" in sent)
        assertFalse("tokenId" in sent)
    }

    @Test
    fun resourceIdentifiersCannotChangeTheEditorRoute() = runTest {
        val fixture = Fixture()
        val tool = editorTokenTools.single { it.name == "token_delete" }
        val arguments = JsonObject(validArguments(tool) + ("tokenId" to JsonPrimitive("../../catalog/components")))
        val result = fixture.core.callTool(tool.name, arguments)
        assertTrue(result.isError)
        assertTrue(fixture.writes.isEmpty())
    }

    @Test
    fun createdConfigurationsExposeTheAppearanceIdForFollowingEditorCalls() = runTest {
        val fixture = Fixture()
        fixture.result = HttpMutationResult.Response(201, "{\"id\":\"new-configuration\"}", emptyMap(), true)
        val tool = editorComponentTools.single { it.name == "component_configuration_create" }
        val result = fixture.core.callTool(tool.name, validArguments(tool))
        assertFalse(result.isError, result.body)
        val data = Json.parseToJsonElement(result.body).jsonObject.getValue("data").jsonObject
        assertEquals(JsonPrimitive("new-configuration"), data["appearanceId"])
    }

    @Test
    fun actualReadContextDoesNotRequireAProjectIdAndStillRejectsAnotherSystem() = runTest {
        val fixture = Fixture()
        for (tool in editorReadTools) {
            val result = fixture.core.callTool(tool.name, validArguments(tool))
            assertFalse(result.isError, result.body)
            val context = Json.parseToJsonElement(result.body).jsonObject.getValue("context").jsonObject
            assertEquals(JsonPrimitive("project"), context["projectId"])
        }
        fixture.result = HttpMutationResult.Response(200, "{}", fixture.readHeaders, true)
        val deletion = editorTokenTools.single { it.name == "token_delete" }
        assertFalse(fixture.core.callTool(deletion.name, validArguments(deletion)).isError)
        fixture.readHeaders = mapOf("x-ds-read-context" to "{\"designSystemId\":\"other\",\"version\":\"draft\"}")
        val editor = editorReadTools.single { it.name == "component_editor_get" }
        assertTrue(fixture.core.callTool(editor.name, validArguments(editor)).isError)
    }

    private fun validArguments(tool: McpToolDefinition): JsonObject {
        val args = tool.inputSchema.filterValues { it.required }.mapValues { sample(it.value) }.toMutableMap()
        if (tool.name.startsWith("color_token_") && "members" in args) {
            val pairs = listOf("web", "ios", "android").flatMap { platform ->
                listOf(
                    "light",
                    "dark",
                ).map { mode ->
                    Json.parseToJsonElement(
                        """
{
  "platform": "$platform",
  "mode": "$mode",
  "value": "#000000",
  "baseRevision": 0
}
""",
                    )
                }
            }
            val key = if (tool.name == "color_token_create") "name" else "tokenId"
            args["members"] = JsonArray(
                listOf(
                    JsonObject(
                        mapOf(
                            key to JsonPrimitive("id"),

                            "values" to JsonArray(pairs),
                        ),
                    ),
                ),
            )
        }
        args["idempotencyKey"]?.let { args["idempotencyKey"] = JsonPrimitive("key") }
        return JsonObject(args)
    }

    private fun sample(input: McpToolInputDefinition): JsonElement = when (input.type) {
        "integer" -> JsonPrimitive(0)
        "number" -> JsonPrimitive(1.0)
        "boolean" -> JsonPrimitive(false)
        "array" -> {
            val item = input.items ?: McpToolInputDefinition(type = input.itemType ?: "string")
            JsonArray(listOf(sample(item)))
        }
        "object" -> JsonObject(input.properties.filterValues { it.required }.mapValues { sample(it.value) })
        else -> JsonPrimitive(input.allowedValues.firstOrNull() ?: "id")
    }

    private class Fixture(version: String? = null) {
        val writes = mutableListOf<HttpMutationRequest>()
        var contextReads = 0
        var failReads = false
        var readHeaders = mapOf(
            "x-ds-read-context" to "{\"designSystemId\":\"system\",\"version\":\"draft\"}",
        )
        var result: HttpMutationResult = HttpMutationResult.Response(
            200,
            "{}",
            emptyMap(),
            true,
        )
        private val context = ProjectContext(
            ProjectId("project"),
            DesignSystemId("system"),
            CredentialEnvName("KEY"),
            "",
            selectedVersion = version,
        )
        private val factory = object : AuthenticatedHttpClientFactory {
            override fun create(
                apiUrl: String,
                apiKey: String,
            ): AuthenticatedHttpClient = object : AuthenticatedHttpClient {
                override suspend fun get(path: String): AuthenticatedHttpResult {
                    if (failReads) return AuthenticatedHttpResult.Failure("unavailable", 503)
                    val body = when {
                        path.endsWith("/tokens/id") ->
                            """
{
  "id": "id",
  "name": "text.default.accent",
  "type": "color"
}
"""
                        path.endsWith("/tokens") ->
                            """
[
  {
    "id": "id",
    "name": "text.default.accent",
    "type": "color"
  }
]
"""
                        path.endsWith("/token-values") ->
                            """
[
  {
    "tokenId": "id",
    "sourceValue": "palette.ref",
    "paletteRef": "palette.ref",
    "overridden": true,
    "editRevision": 7
  }
]
"""
                        else -> "{}"
                    }
                    return AuthenticatedHttpResult.Success(body, readHeaders)
                }
                override suspend fun post(
                    path: String,
                    body: String,
                ): AuthenticatedHttpResult = error("Use mutation transport")
                override suspend fun mutate(request: HttpMutationRequest): HttpMutationResult {
                    writes += request
                    return result
                }
            }
        }
        private val dependencies = module {
            single {
                ContextResolver(
                    listOf(
                        ContextSource {
                            contextReads++
                            ContextSourceResult.Found(context)
                        },
                    ),
                )
            }
            single { ApiUrlResolver { null } }
            single<AuthenticatedHttpClientFactory> { factory }
            single<CredentialProvider> {
                object : CredentialProvider {
                    override suspend fun resolve(
                        apiUrl: ProjectApiUrl,
                        projectKeyOverride: String?,
                        credentialEnvName: CredentialEnvName,
                    ): CredentialResult =
                        CredentialResult.Selected(
                            BackendCredential.PersonalAccessToken("key"),
                            BackendCredentialType.PERSONAL_ACCESS_TOKEN,
                        )
                }
            }
        }
        private val koin = koinApplication {
            modules(
                themeApplicationModule(),
                componentsApplicationModule(),
                dependencies,
            )
        }.koin
        val core = DsBuilderMcpServerCore(
            McpServerConfig(),
            McpProjectStatusReader { _,
                                     _,
                                     _,
                ->
                CheckProjectStatusResult.Authorized(
                    "p",
                    "s",
                    "",
                    "",
                )
            },

            editTokenUseCase = koin.get(),
            editThemeUseCase = koin.get(),
            readTokenEditDataUseCase = koin.get(),
            editComponentUseCase = koin.get(),

        )
    }
}
