package com.dsbuilder.app.data.aitools

import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentReplayException
import com.dsbuilder.ds.core.application.IdempotentResponse
import com.dsbuilder.ds.core.application.ModelReadPage
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DsToolCallTest {
    private val call = DsToolCall(
        "tokens_list",
        ChatToolContext(
            ProjectPrincipal(ProjectActorType.USER, "user", "project", projectRole = "owner"),
            UUID.randomUUID().toString(),
            "correlation",
        ),
    )
    private val serializer = ListSerializer(String.serializer())

    @Test
    fun pageKeepsItemsAndCursorWithoutIntroducingMutationMetadata() = runBlocking {
        val result = call.respondPage(serializer) {
            DsResult.Success(listOf("one"), mutationMetadata = "[]", readPage = ModelReadPage(1, "next"))
        }
        assertFalse(result.isError)
        assertEquals(json("""{"items":["one"],"nextCursor":"next"}"""), json(result.content))
        val last = call.respondPage(serializer) { DsResult.Success(emptyList()) }
        assertEquals(json("""{"items":[]}"""), json(last.content))
    }

    @Test
    fun ordinarySuccessKeepsItsMutationMetadata() = runBlocking {
        val result = call.respond({ value: String -> JsonPrimitive(value) }) {
            DsResult.Success("saved", mutationMetadata = "[]")
        }
        assertEquals(json("""{"result":"saved","mutationMetadata":[]}"""), json(result.content))
    }

    @Test
    fun pageFailureUsesTheSameErrorAsAnEarlyRejection() = runBlocking {
        val failure = DsFailure.Conflict("STALE", editRevision = 3, draftRevision = 5, message = "Changed")
        val result = call.respondPage(serializer) { DsResult.Failure(failure) }
        assertEquals(call.reject(failure), result)
        assertTrue(result.isError)
        assertEquals("CONFLICT", result.code)
        assertEquals("STALE", result.backendCode)
        assertEquals(
            json(
                """{"code":"CONFLICT","backendCode":"STALE","message":"Changed","editRevision":3,"draftRevision":5}""",
            ),
            json(result.content),
        )
    }

    @Test
    fun rejectionKeepsPublicAndBackendCodesForEveryFailureKind() {
        val cases = listOf(
            Triple(DsFailure.Forbidden, "FORBIDDEN", null),
            Triple(DsFailure.NotFound, "NOT_FOUND", null),
            Triple(DsFailure.InvalidRequest("invalid"), "INVALID_ARGUMENT", "invalid"),
            Triple(DsFailure.Conflict("stale"), "CONFLICT", "stale"),
            Triple(DsFailure.Unprocessable("rule", "Rejected"), "VALIDATION_FAILED", "rule"),
            Triple(DsFailure.DependencyUnavailable("storage"), "BACKEND_UNAVAILABLE", null),
            Triple(DsFailure.TechnicalFailure, "BACKEND_UNAVAILABLE", null),
        )
        cases.forEach { (failure, code, backendCode) ->
            val result = call.reject(failure)
            assertTrue(result.isError)
            assertEquals(code, result.code)
            assertEquals(backendCode, result.backendCode)
            assertEquals(JsonPrimitive(code), json(result.content)["code"])
            if (backendCode == null) {
                assertFalse("backendCode" in json(result.content))
            } else {
                assertEquals(JsonPrimitive(backendCode), json(result.content)["backendCode"])
            }
        }
    }

    @Test
    fun replayUsesTheSavedBodyAndMetadataWithoutEncodingAgain() = runBlocking {
        val replay = IdempotentReplayException(IdempotentResponse(200, """{"saved":true}""", "[]"))
        val result = call.respond<String>({ error("Replay must not invoke the encoder") }) { throw replay }
        val page = call.respondPage(serializer) { throw replay }
        val expected = json("""{"result":{"saved":true},"mutationMetadata":[]}""")
        assertEquals(expected, json(result.content))
        assertEquals(expected, json(page.content))
    }

    @Test
    fun sharedArgumentsKeepPaginationDefaultsAndBounds() {
        assertEquals(50, json("{}").page()?.limit)
        assertEquals(200, json("""{"limit":200,"cursor":"next"}""").page()?.limit)
        assertEquals("next", json("""{"cursor":"next"}""").page()?.cursor)
        assertEquals(3, json("""{"limit":"3"}""").page()?.limit)
        listOf("""{"limit":0}""", """{"limit":201}""", """{"cursor":""}""").forEach {
            assertNull(json(it).page())
        }
        assertNull(json("""{"name":10}""").text("name"))
        assertNull(json("""{"id":"invalid"}""").uuid("id"))
        val id = UUID.randomUUID()
        assertEquals(id, json("""{"id":"$id"}""").uuid("id"))
    }

    private fun json(value: String): JsonObject = Json.parseToJsonElement(value).jsonObject
}
