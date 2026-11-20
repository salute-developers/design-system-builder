package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.data.tools.ChatToolCatalog
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.app.DsServiceConfiguration
import com.dsbuilder.ds.app.module
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.koin.core.Koin
import org.koin.ktor.ext.getKoin
import org.testcontainers.containers.PostgreSQLContainer
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/** Каждый инструмент чата вызывает свой use case ds-service внутри процесса на настоящей БД. */
@org.junit.experimental.categories.Category(com.dsbuilder.testing.IntegrationTest::class)
class InProcessChatToolsIntegrationTest {
    @Test
    fun everyCatalogToolRunsAgainstDsAndKeepsTheRulesOfTheUseCase() {
        val postgres = PostgreSQLContainer<Nothing>("postgres:16-alpine").apply { start() }
        try {
            testApplication {
                lateinit var koin: Koin
                application {
                    module(dsConfiguration(postgres))
                    koin = getKoin()
                }
                call(client, "GET", ROOT)
                ChatToolsComponentSeed.seed(postgres)
                val system = id(call(client, "POST", ROOT, """{"name":"chat-tools","projectName":"chat"}"""))
                val tenant = id(call(client, "POST", "$ROOT/$system/tenants", """{"name":"chat-theme"}"""))
                val tools = inProcessChatTools(koin)
                val run = Runner(tools, system)
                assertEquals(ChatToolCatalog.names, tools.supportedTools, "Every catalog tool needs a handler")

                // Чтение DS и токенов.
                val context = run.ok("design_system_get_context", "{}").obj()
                val draft = context.text("draftId")
                assertEquals(draft, tools.activeDraftId(OWNER, system))
                run.ok("tenants_list", "{}")
                run.ok("token_groups_list", "{}")
                val colorToken = run.ok("tokens_list", """{"type":"color","name":"background.default.primary"}""")
                    .obj().getValue("items").jsonArray.single().jsonObject.text("id")
                run.ok("token_get", """{"tokenId":"$colorToken"}""")
                val values = run.ok("token_values_get", """{"tokenId":"$colorToken","platform":"web","mode":"light"}""")
                listOf("tenantId", "platform", "mode").forEach { field ->
                    val rejected = run.call("token_values_get", """{"tokenId":"$colorToken","$field":"invalid"}""")
                    assertEquals("INVALID_ARGUMENT" to "invalid_query", rejected.code to rejected.backendCode)
                }
                run.ok("token_values_get", """{"tokenId":"$colorToken"}""")
                run.ok("token_values_get", """{"tokenId":"$colorToken","tenantId":null,"platform":null,"mode":null}""")
                val currentValue = Json.parseToJsonElement(values.content).jsonArray.first().jsonObject
                val valueId = currentValue.text("id")
                run.ok("palette_get", """{"tenantId":"$tenant"}""")
                run.ok("token_edit_data_get", """{"tokenId":"$colorToken","tenantId":"$tenant"}""")

                // Чтение компонентов.
                val button = Json.parseToJsonElement(run.ok("components_list", "{}").content).jsonArray
                    .first { it.jsonObject.text("name") == "Button" }.jsonObject.text("id")
                val configurations = run.ok("component_configurations_list", """{"componentId":"$button"}""").obj()
                val appearance = configurations.getValue("items").jsonArray.first().jsonObject.text("id")
                run.ok("component_variations_get", """{"appearanceId":"$appearance"}""")
                run.ok("component_properties_get", """{"componentId":"$button"}""")
                val editor = run.ok("component_editor_get", """{"appearanceId":"$appearance"}""").obj()
                run.ok("component_config_get", """{"appearanceId":"$appearance"}""")
                val axes = editor.getValue("axes").jsonArray.map { it.jsonObject }
                val selection = axes.map { it.getValue("values").jsonArray.first().jsonObject.text("id") }
                run.ok(
                    "component_tokens_get",
                    """{"appearanceId":"$appearance","selectedValueIds":${selection.joinToString(
                        ",",
                        "[",
                        "]",
                    ) { "\"$it\"" }}}""",
                )

                // Запись значения размера: повтор по ключу, другой ключ, другая команда, отказ use case.
                val radius = sizeToken(client, system, tenant)
                val sizeArgs = """{"tenantId":"$tenant","tokenId":"$radius","valuePx":21}"""
                val first = run.ok("size_token_value_update", sizeArgs, key = "size-key")
                val replay = run.ok("size_token_value_update", sizeArgs, key = "size-key")
                assertEquals(first.content, replay.content, "Replay returns the stored result")
                val reused = run.call("size_token_value_update", sizeArgs.replace("21", "22"), key = "size-key")
                assertEquals("CONFLICT" to "IDEMPOTENCY_KEY_REUSED", reused.code to reused.backendCode)
                val denied = run.call("size_token_value_update", sizeArgs.replace("21", "23"), principal = VIEWER)
                assertEquals("FORBIDDEN", denied.code)
                assertEquals(21, sizeValue(client, system, tenant, radius))

                // Запись цвета, значения токена и типографики.
                // Значение со ссылкой на палитру маршрут отклоняет; инструмент обязан ответить тем же кодом.
                val patchBody = """{"value":${currentValue.getValue("value")}}"""
                val viaHttp = call(client, "PATCH", "$ROOT/$system/token-values/$valueId", patchBody)
                val viaTool = run.call(
                    "token_value_update",
                    """{"valueId":"$valueId","value":${currentValue.getValue("value")}}""",
                )
                val httpCode = Json.parseToJsonElement(viaHttp.bodyAsText()).jsonObject["code"]?.jsonPrimitive?.content
                assertEquals(viaHttp.status.isSuccess(), !viaTool.isError, viaTool.content)
                if (viaTool.isError) assertEquals(httpCode, viaTool.backendCode)
                run.ok(
                    "color_token_values_update",
                    """{"tenantId":"$tenant","tokenId":"$colorToken","members":[{"tokenId":"$colorToken",""" +
                        """"values":[{"platform":"web","mode":"light","value":"#00FF00"}]}]}""",
                )
                val typography = run.ok("tokens_list", """{"type":"typography","limit":1}""")
                    .obj().getValue("items").jsonArray.single().jsonObject.text("id")
                run.ok("typography_style_update", """{"tenantId":"$tenant","tokenId":"$typography","size":17}""")

                // Записи компонента: свойство, сброс, новое значение вариации, дубль конфигурации.
                val background = editor.getValue("propertyValues").jsonArray.map { it.jsonObject }
                    .first { it.text("propertyName") == "backgroundColor" && it.getValue("states").jsonArray.isEmpty() }
                val property = background.text("propertyId")
                val styles = background.getValue("styleIds").jsonArray.toString()
                run.ok(
                    "component_property_set",
                    """{"appearanceId":"$appearance","propertyId":"$property","styleIds":$styles,"states":[],""" +
                        """"value":"12px"}""",
                )
                run.ok(
                    "component_property_reset",
                    """{"appearanceId":"$appearance","propertyId":"$property","styleIds":$styles,"states":[]}""",
                )
                run.ok(
                    "component_axis_value_create",
                    """{"appearanceId":"$appearance","axisId":"${axes.first().text("id")}","name":"chat-new"}""",
                )
                val duplicateArgs = """{"appearanceId":"$appearance","name":"chat-copy"}"""
                val copy = run.ok("component_configuration_duplicate", duplicateArgs, key = "copy-key")
                assertEquals(
                    copy.content,
                    run.ok("component_configuration_duplicate", duplicateArgs, key = "copy-key").content,
                )
                val after = run.ok("component_configurations_list", """{"componentId":"$button"}""").obj()
                assertEquals(2, after.getValue("items").jsonArray.size, "Replay must not create a second copy")

                // Подтверждённая операция после публикации не попадает в следующий черновик.
                publish(client, system)
                val next = tools.activeDraftId(OWNER, system)
                assertNotEquals(draft, next)
                val stale = run.call("size_token_value_update", sizeArgs.replace("21", "30"), expectedDraft = draft)
                assertEquals("CONFLICT" to "draft_changed", stale.code to stale.backendCode)
                assertNotEquals(30, sizeValue(client, system, tenant, radius))
            }
        } finally {
            postgres.stop()
        }
    }

    /** Вызывает инструменты от имени участника с ключом идемпотентности на каждую запись. */
    private class Runner(private val tools: InProcessChatTools, private val system: String) {
        suspend fun call(
            name: String,
            arguments: String,
            key: String = UUID.randomUUID().toString(),
            principal: ProjectPrincipal = OWNER,
            expectedDraft: String? = null,
        ): ToolResult = tools.execute(
            name,
            Json.parseToJsonElement(arguments).jsonObject,
            ChatToolContext(principal, system, "turn:$name", idempotencyKey = key, expectedDraftId = expectedDraft),
        )

        suspend fun ok(name: String, arguments: String, key: String = UUID.randomUUID().toString()): ToolResult =
            call(name, arguments, key).also { assertFalse(it.isError, "$name failed: ${it.content}") }
    }

    private fun dsConfiguration(postgres: PostgreSQLContainer<Nothing>) = DsServiceConfiguration(
        port = 0,
        databaseUrl = postgres.jdbcUrl,
        databaseUser = postgres.username,
        databasePassword = postgres.password,
        databasePoolSize = 4,
        databaseConnectionTimeoutMs = 5_000,
        authorizationPolicyPath = null,
        runFlyway = true,
        adoptExistingSchema = false,
        expectedSchemaFingerprint = null,
    )

    private fun ToolResult.obj(): JsonObject = Json.parseToJsonElement(content).jsonObject.let { body ->
        body["result"]?.takeIf { "mutationMetadata" in body }?.jsonObject ?: body
    }

    private fun JsonObject.text(name: String) = getValue(name).jsonPrimitive.content

    private suspend fun sizeToken(client: HttpClient, system: String, tenant: String): String =
        read(client, "$ROOT/$system/tenants/$tenant/size-tokens").getValue("radii").jsonArray
            .first { "full" !in it.jsonObject.text("name") }.jsonObject.text("tokenId")

    private suspend fun sizeValue(client: HttpClient, system: String, tenant: String, token: String): Int {
        val item = read(client, "$ROOT/$system/tenants/$tenant/size-tokens").getValue("radii").jsonArray
            .map { it.jsonObject }.first { it.text("tokenId") == token }
        return requireNotNull(Regex("\"valuePx\"\\s*:\\s*(\\d+)").find(item.toString())).groupValues[1].toInt()
    }

    private suspend fun publish(client: HttpClient, system: String) {
        val cursor = read(client, "$ROOT/$system")
        val response = call(
            client,
            "POST",
            "$ROOT/$system/versions",
            """{"draftId":"${cursor.text("draftId")}","draftRevision":${cursor.text("draftRevision")},""" +
                """"version":"1.0.0","changelog":"chat"}""",
        )
        assertEquals(HttpStatusCode.Created, response.status, response.bodyAsText())
    }

    private suspend fun read(client: HttpClient, path: String): JsonObject {
        val response = call(client, "GET", path)
        assertEquals(HttpStatusCode.OK, response.status, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject
    }

    private suspend fun id(response: HttpResponse): String {
        assertTrue(response.status.value in 200..201, response.bodyAsText())
        return Json.parseToJsonElement(response.bodyAsText()).jsonObject.text("id")
    }

    private suspend fun call(client: HttpClient, method: String, path: String, body: String? = null): HttpResponse =
        client.request(path) {
            this.method = HttpMethod.parse(method)
            header("X-Actor-Type", "user")
            header("X-User-Id", OWNER.actorId)
            header("X-Project-Id", PROJECT)
            header("X-Project-Role", "owner")
            header("Idempotency-Key", UUID.randomUUID().toString())
            body?.let {
                contentType(ContentType.Application.Json)
                setBody(it)
            }
        }

    private companion object {
        const val ROOT = "/api/design-systems"
        const val PROJECT = "chat-project"
        val OWNER = ProjectPrincipal(ProjectActorType.USER, "owner-1", PROJECT, projectRole = "owner")
        val VIEWER = ProjectPrincipal(ProjectActorType.USER, "viewer-1", PROJECT, projectRole = "viewer")
    }
}
