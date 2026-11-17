package com.dsbuilder.ai.chat.data

import com.dsbuilder.ai.chat.application.ChatAccess
import com.dsbuilder.ai.chat.application.ChatToolContext
import com.dsbuilder.ai.chat.application.ChatToolExecutor
import com.dsbuilder.ai.chat.application.ChatToolKind
import com.dsbuilder.ai.chat.data.tools.ChatToolCatalog
import com.dsbuilder.ai.chat.data.tools.integer
import com.dsbuilder.ai.chat.data.tools.text
import com.dsbuilder.ai.chat.data.tools.tool
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

class CatalogAgentToolboxTest {
    private val catalog = listOf(
        tool("things_list", "List", "things:read", ChatToolKind.READ),
        tool("thing_set", "Set", "things:write", ChatToolKind.WRITE, text("thingId", "id"), integer("value", "v")),
        tool("thing_reset", "Reset", "things:delete", ChatToolKind.DESTRUCTIVE, text("thingId", "id")),
    )
    private val principal = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", projectRole = "editor")
    private val context = ChatToolContext(principal, "ds-1", "turn:c1", idempotencyKey = "key-1")

    private class RecordingExecutor(
        override val supportedTools: Set<String> = setOf("things_list", "thing_set", "thing_reset"),
        private val gate: CompletableDeferred<Unit>? = null,
        private val failure: Exception? = null,
    ) : ChatToolExecutor {
        val calls = mutableListOf<Pair<JsonObject, ChatToolContext>>()
        val finished = AtomicInteger()

        override suspend fun execute(name: String, arguments: JsonObject, context: ChatToolContext): ToolResult {
            calls += arguments to context
            gate?.await()
            failure?.let { throw it }
            finished.incrementAndGet()
            return ToolResult("", name, """{"ok":true}""", isError = false)
        }

        override suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String) = "draft-1"
    }

    private fun toolbox(executor: ChatToolExecutor = RecordingExecutor(), timeout: kotlin.time.Duration = 5.seconds) =
        CatalogAgentToolbox(catalog, executor, timeout)

    @Test
    fun specsAndAccessFollowExactPermissions() {
        val editor = ChatAccess { it in setOf("things:read", "things:write") }
        val box = toolbox()

        assertEquals(listOf("things_list", "thing_set"), box.specs(editor).map { it.name })
        assertTrue(box.isAllowed("thing_set", editor))
        assertFalse(box.isAllowed("thing_reset", editor))
        assertFalse(box.isAllowed("token_delete", ChatAccess { true }))
        assertTrue(box.isWrite("thing_set") && box.isWrite("thing_reset") && !box.isWrite("things_list"))
        assertTrue(box.isDestructive("thing_reset") && !box.isDestructive("thing_set"))
    }

    @Test
    fun prepareDropsServerFieldsAndChecksTheSchema() {
        val box = toolbox()
        val call = ToolCall(
            "c1",
            "thing_set",
            JsonObject(
                mapOf(
                    "thingId" to JsonPrimitive("t1"),
                    "value" to JsonPrimitive(3),
                    "designSystemId" to JsonPrimitive("other-ds"),
                    "version" to JsonPrimitive("1.0.0"),
                    "idempotencyKey" to JsonPrimitive("model-key"),
                    "expectedDraftId" to JsonPrimitive("draft-x"),
                ),
            ),
        )

        val prepared = assertNotNull(box.prepare(call))
        assertEquals(setOf("thingId", "value"), prepared.arguments.keys)
        assertNull(box.prepare(call.copy(arguments = JsonObject(mapOf("thingId" to JsonPrimitive("t1"))))))
        assertNull(
            box.prepare(
                call.copy(
                    arguments = JsonObject(mapOf("thingId" to JsonPrimitive("t1"), "value" to JsonPrimitive("x"))),
                ),
            ),
        )
        assertNull(box.prepare(call.copy(name = "unknown")))
    }

    @Test
    fun executePassesTheContextAndSetsTheCallId() = runBlocking<Unit> {
        val executor = RecordingExecutor()
        val call = ToolCall("c7", "thing_set", JsonObject(mapOf("thingId" to JsonPrimitive("t1"))))

        val result = toolbox(executor).execute(call, context)

        assertEquals("c7", result.callId)
        assertEquals("thing_set", result.name)
        assertEquals(context, executor.calls.single().second)
    }

    @Test
    fun exceptionsBecomeUnknownOutcomeForWritesAndUnavailableForReads() = runBlocking<Unit> {
        val box = toolbox(RecordingExecutor(failure = IllegalStateException("secret details")))

        val write = box.execute(ToolCall("c1", "thing_set", JsonObject(emptyMap())), context)
        val read = box.execute(ToolCall("c2", "things_list", JsonObject(emptyMap())), context)

        assertEquals("OUTCOME_UNKNOWN", write.code)
        assertEquals("BACKEND_UNAVAILABLE", read.code)
        assertFalse("secret details" in write.content)
    }

    @Test
    fun timeoutAbandonsTheCallAndBlocksTheNextCallOfTheSameUserUntilItFinishes() = runBlocking<Unit> {
        val gate = CompletableDeferred<Unit>()
        val executor = RecordingExecutor(gate = gate)
        val box = toolbox(executor, timeout = 100.milliseconds)
        val write = ToolCall("c1", "thing_set", JsonObject(emptyMap()))

        assertEquals("OUTCOME_UNKNOWN", box.execute(write, context).code)
        val blocked = box.execute(write.copy(id = "c2"), context)
        assertEquals("BACKEND_UNAVAILABLE", blocked.code)
        assertEquals(1, executor.calls.size, "The blocked call must not start")

        val other = ProjectPrincipal(ProjectActorType.USER, "user-2", "project-1", projectRole = "editor")
        assertEquals("OUTCOME_UNKNOWN", box.execute(write.copy(id = "c3"), context.copy(principal = other)).code)

        gate.complete(Unit)
        box.drain(5.seconds)
        assertEquals(2, executor.finished.get(), "Abandoned calls run to completion")
        assertFalse(box.execute(write.copy(id = "c4"), context).isError)
    }

    @Test
    fun catalogWithoutHandlerFailsAssemblyWithTheToolName() {
        val failure = assertFailsWith<IllegalStateException> {
            toolbox(RecordingExecutor(supportedTools = setOf("things_list", "thing_set")))
        }
        assertTrue("thing_reset" in failure.message.orEmpty())
    }

    @Test
    fun chatCatalogIsWellFormed() {
        val tools = ChatToolCatalog.tools
        assertEquals(23, tools.size)
        assertEquals(tools.size, ChatToolCatalog.names.size, "Tool names must be unique")
        assertEquals(15, tools.count { it.kind == ChatToolKind.READ })
        assertEquals(
            listOf("component_property_reset"),
            tools.filter { it.kind == ChatToolKind.DESTRUCTIVE }.map { it.name },
        )
        tools.forEach { definition ->
            assertTrue(definition.permission.isNotBlank(), definition.name)
            assertTrue(definition.description.isNotBlank() && definition.description != "TODO", definition.name)
            assertEquals(JsonPrimitive("object"), definition.inputSchema["type"], definition.name)
            val properties = definition.inputSchema["properties"]?.jsonObject.orEmpty().keys
            val forbidden =
                setOf("designSystem", "designSystemId", "version", "versionId", "idempotencyKey", "expectedDraftId")
            assertTrue((properties intersect forbidden).isEmpty(), "${definition.name} exposes server fields")
            val required = (definition.inputSchema["required"] as JsonArray).map { (it as JsonPrimitive).content }
            assertTrue(properties.containsAll(required), "${definition.name} requires undeclared fields")
        }
    }
}
