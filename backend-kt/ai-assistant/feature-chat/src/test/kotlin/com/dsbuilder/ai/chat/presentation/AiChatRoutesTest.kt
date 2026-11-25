package com.dsbuilder.ai.chat.presentation

import com.dsbuilder.ai.chat.application.ChatTurnScope
import com.dsbuilder.ai.chat.application.FakeToolbox
import com.dsbuilder.ai.chat.application.LlmClient
import com.dsbuilder.ai.chat.application.OwnershipCheck
import com.dsbuilder.ai.chat.application.RunChatTurnUseCase
import com.dsbuilder.ai.chat.application.ScriptedLlm
import com.dsbuilder.ai.chat.application.StartChatTurnUseCase
import com.dsbuilder.ai.chat.application.ValidateChatTurnUseCase
import com.dsbuilder.ai.chat.application.limits
import com.dsbuilder.ai.chat.data.HmacConfirmationSigner
import com.dsbuilder.ai.chat.data.InMemoryTurnStore
import com.dsbuilder.ai.chat.di.AiAssistant
import com.dsbuilder.ai.chat.di.AiAssistantConfiguration
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.authorization.AuthorizationPolicyLoader
import com.dsbuilder.authorization.PolicyEvaluator
import io.ktor.client.HttpClient
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.routing.route
import io.ktor.server.routing.routing
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds

class AiChatRoutesTest {
    private val evaluator = PolicyEvaluator(AuthorizationPolicyLoader.load(null))
    private val configuration =
        AiAssistantConfiguration.fromEnvironment(
            mapOf(
                "AI_ENABLED" to "true",
                "AI_API_KEY" to "k",
                "AI_BASE_URL" to "https://llm.test/v1",
                "AI_MODEL" to "glm-4.5-flash",
            )::get,
        )

    private fun assistant(llm: LlmClient = ScriptedLlm({ LlmResponse.Text("ok") })): AiAssistant {
        val limits = limits()
        val store = InMemoryTurnStore(limits.turnStoreMaxBytes)
        val signer = HmacConfirmationSigner()
        val scope = ChatTurnScope(Dispatchers.Default)
        val runner = RunChatTurnUseCase(llm, FakeToolbox(), signer, store, limits)
        return AiAssistant(
            configuration,
            ValidateChatTurnUseCase(limits),
            StartChatTurnUseCase(store, { _, _ -> OwnershipCheck.OWNED }, signer, runner, scope),
            store,
            scope,
            {},
            emptyList(),
        )
    }

    private fun routesTest(
        assistant: AiAssistant?,
        block: suspend ApplicationTestBuilder.() -> Unit,
    ) = testApplication {
        application {
            routing {
                route("/api/projects/{projectId}/ai") {
                    aiChatRoutes(
                        assistant,
                        evaluator,
                        trustedHeaders = { it.request.headers },
                        heartbeat = 50.milliseconds,
                    )
                }
            }
        }
        block()
    }

    private suspend fun HttpClient.chat(
        key: String? = "k1",
        body: String = BODY,
        user: String = "user-1",
        project: String = "project-1",
    ): HttpResponse =
        post("/api/projects/project-1/ai/chat") {
            trusted(user, project)
            key?.let { header("Idempotency-Key", it) }
            header(HttpHeaders.Authorization, "Bearer user-secret-token")
            contentType(ContentType.Application.Json)
            setBody(body)
        }

    private fun io.ktor.client.request.HttpRequestBuilder.trusted(
        user: String = "user-1",
        project: String = "project-1",
    ) {
        header("X-Actor-Type", "user")
        header("X-User-Id", user)
        header("X-Project-Id", project)
        header("X-Project-Role", "editor")
    }

    private suspend fun HttpClient.events(
        turnId: String,
        after: String? = null,
        user: String = "user-1",
    ): HttpResponse =
        get("/api/projects/project-1/ai/turns/$turnId/events" + (after?.let { "?after=$it" } ?: "")) { trusted(user) }

    private suspend fun HttpResponse.turnId() =
        Json.parseToJsonElement(bodyAsText()).jsonObject.getValue("turnId").jsonPrimitive.content
    private suspend fun HttpResponse.code() =
        Json.parseToJsonElement(bodyAsText()).jsonObject["code"]?.jsonPrimitive?.content

    @Test
    fun statusReportsDisabledAndEnabled() {
        routesTest(null) {
            assertEquals(
                """{"enabled":false}""",
                client.get("/api/projects/project-1/ai/status") { trusted() }.bodyAsText(),
            )
            assertEquals(HttpStatusCode.ServiceUnavailable, client.chat().status)
        }
        routesTest(assistant()) {
            val status = Json.parseToJsonElement(
                client.get("/api/projects/project-1/ai/status") { trusted() }.bodyAsText(),
            ).jsonObject
            assertFalse("minTokenLifetimeSeconds" in status)
            assertEquals("openai-compatible", status.getValue("provider").jsonPrimitive.content)
            assertEquals("glm-4.5-flash", status.getValue("model").jsonPrimitive.content)
            assertEquals(
                configuration.limits?.historyMaxChars.toString(),
                status.getValue("historyMaxChars").jsonPrimitive.content,
            )
            assertEquals(
                configuration.limits?.messageMaxChars.toString(),
                status.getValue("messageMaxChars").jsonPrimitive.content,
            )
            assertEquals(setOf("enabled", "provider", "model", "messageMaxChars", "historyMaxChars"), status.keys)
            assertFalse("k" == status["apiKey"]?.jsonPrimitive?.content)
        }
    }

    @Test
    fun postAcceptsRepeatsAndRejects() = routesTest(assistant()) {
        assertEquals("invalid_request", client.chat(key = null).code())
        assertEquals("invalid_request", client.chat(key = "bad", body = "{").code())
        assertEquals(HttpStatusCode.Forbidden, client.chat(project = "project-2").status)

        val accepted = client.chat()
        assertEquals(HttpStatusCode.Accepted, accepted.status)
        val turnId = accepted.turnId()
        assertTrue(client.events(turnId).bodyAsText().contains("event: done"))
        assertEquals(turnId, client.chat().turnId())
        assertEquals("IDEMPOTENCY_KEY_REUSED", client.chat(body = BODY.replace("привет", "другое")).code())
        val withContext = BODY.replace("}]}", """}],"context":{"section":"colors"}}""")
        assertEquals("IDEMPOTENCY_KEY_REUSED", client.chat(body = withContext).code())
        val badContext = BODY.replace("}]}", """}],"context":{"section":"nope"}}""")
        assertEquals("invalid_request", client.chat(key = "k-bad", body = badContext).code())
    }

    @Test
    fun personalAccessTokenCannotStartATurn() = routesTest(assistant()) {
        val response = client.post("/api/projects/project-1/ai/chat") {
            header("X-Actor-Type", "personal_access_token")
            header("X-User-Id", "user-1")
            header("X-Project-Id", "project-1")
            header("X-Project-Role", "editor")
            header("X-Project-Scopes", "design-systems:read")
            header("X-Personal-Access-Token-Id", "pat-1")
            header("Idempotency-Key", "pat-key")
            contentType(ContentType.Application.Json)
            setBody(BODY)
        }

        assertEquals(HttpStatusCode.Forbidden, response.status)
        assertEquals("ai_pat_forbidden", response.code())
    }

    @Test
    fun eventsStreamWithIdsResumeAfterCursorAndHideTheBearer() = routesTest(assistant()) {
        val turnId = client.chat().turnId()
        val full = client.events(turnId).bodyAsText()

        assertTrue(full.contains("id: 1\nevent: message"), full)
        assertTrue(full.contains("event: state"))
        assertTrue(full.trimEnd().endsWith("data: {}"))
        assertFalse(full.contains("user-secret-token"))
        val tail = client.events(turnId, after = "2").bodyAsText()
        assertFalse(tail.contains("id: 1\n"))
        assertTrue(tail.contains("id: 3\nevent: done"))
        assertEquals(HttpStatusCode.BadRequest, client.events(turnId, after = "-1").status)
        assertEquals(HttpStatusCode.NotFound, client.events("unknown").status)
        assertEquals(HttpStatusCode.NotFound, client.events(turnId, user = "user-2").status)
    }

    @Test
    fun heartbeatIsWrittenWhileTheModelThinks() = routesTest(
        assistant(object : LlmClient {
            override suspend fun complete(request: LlmRequest): LlmResponse {
                delay(200)
                return LlmResponse.Text("ok")
            }
        }),
    ) {
        val turnId = client.chat().turnId()
        assertTrue(client.events(turnId).bodyAsText().contains(": heartbeat"))
    }

    @Test
    fun busyStopAndDelete() {
        val gate = CompletableDeferred<Unit>()
        routesTest(
            assistant(object : LlmClient {
                override suspend fun complete(request: LlmRequest): LlmResponse {
                    gate.await()
                    return LlmResponse.Text("ok")
                }
            }),
        ) {
            val turnId = client.chat().turnId()
            val busy = client.chat(key = "k2")
            assertEquals(HttpStatusCode.TooManyRequests, busy.status)
            val details = Json.parseToJsonElement(busy.bodyAsText()).jsonObject
            assertEquals(turnId, details.getValue("activeTurnId").jsonPrimitive.content)
            assertEquals("project-1", details.getValue("projectId").jsonPrimitive.content)
            assertEquals("ds-1", details.getValue("designSystemId").jsonPrimitive.content)

            assertEquals(
                HttpStatusCode.NotFound,
                client.delete("/api/projects/project-1/ai/turns/$turnId") { trusted("user-2") }.status,
            )
            assertEquals(
                HttpStatusCode.NoContent,
                client.delete("/api/projects/project-1/ai/turns/$turnId") { trusted() }.status,
            )
            gate.complete(Unit)
            client.events(turnId).bodyAsText()
            assertEquals(
                HttpStatusCode.NoContent,
                client.delete("/api/projects/project-1/ai/turns/$turnId") { trusted() }.status,
            )
        }
    }

    private companion object {
        const val BODY = """{"designSystemId":"ds-1","messages":[{"role":"user","text":"привет"}]}"""
    }
}
