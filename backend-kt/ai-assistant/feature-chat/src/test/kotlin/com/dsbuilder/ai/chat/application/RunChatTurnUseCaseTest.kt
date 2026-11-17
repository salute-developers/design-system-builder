package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.ConfirmationReason
import com.dsbuilder.ai.chat.domain.LlmFailure
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds

class RunChatTurnUseCaseTest {
    private val read = ToolCall("c1", "components_list", args("name" to "Button"))
    private val write = ToolCall("c2", "component_property_set", args("appearanceId" to "a1", "value" to "red"))
    private val reset = ToolCall("c3", "component_property_reset", args("appearanceId" to "a1"))

    @Test
    fun `text answer ends with message state and done`() = runBlocking<Unit> {
        val events = TurnHarness(ScriptedLlm({ LlmResponse.Text("Привет") })).run(listOf(user("привет")))

        assertEquals(ChatEvent.Message("Привет"), events[0])
        assertIs<ChatEvent.State>(events[1])
        assertEquals(ChatEvent.Done, events.last())
    }

    @Test
    fun `read then write chain is executed in order and recorded in state`() = runBlocking<Unit> {
        val harness = TurnHarness(
            ScriptedLlm({ LlmResponse.ToolCalls(listOf(read)) }, { LlmResponse.ToolCalls(listOf(write)) }),
        )
        val events = harness.run(listOf(user("перекрась кнопку")))

        assertEquals(listOf("components_list", "component_property_set"), harness.toolbox.executed.map { it.name })
        assertEquals(2, events.filterIsInstance<ChatEvent.ToolStarted>().size)
        assertEquals(2, events.filterIsInstance<ChatEvent.ToolFinished>().size)
        val state = events.finalState()
        assertEquals(listOf("c1", "c2"), state.mapNotNull { it.toolResult?.callId })
        assertFalse("idempotencyKey" in harness.toolbox.executed[0].arguments, "Reads get no idempotency key")
        assertEquals(
            "key-1",
            harness.toolbox.executed[1].arguments.getValue("idempotencyKey").let { (it as JsonPrimitive).content },
        )
        assertEquals(principal, harness.toolbox.contexts[1].principal)
        assertEquals("ds-1", harness.toolbox.contexts[1].designSystemId)
    }

    @Test
    fun `destructive call in the middle pauses and later calls are not executed`() = runBlocking<Unit> {
        val third = ToolCall("c4", "token_value_update", args("valueId" to "v"))
        val harness = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(read, reset, third)) }))
        val events = harness.run(listOf(user("сбрось фон")))

        assertEquals(listOf("components_list"), harness.toolbox.executed.map { it.name })
        val pause = events.filterIsInstance<ChatEvent.ConfirmationRequired>().single()
        assertEquals(ConfirmationReason.DESTRUCTIVE, pause.reason)
        assertFalse("idempotencyKey" in pause.arguments)
        val assistant = events.finalState().last { it.role == ChatRole.ASSISTANT }
        assertEquals(listOf("c1", "c3"), assistant.toolCalls.map { it.id })
        assertEquals(ChatEvent.Done, events.last())
    }

    @Test
    fun `approved confirmation executes the token operation with its key and draft`() = runBlocking<Unit> {
        val harness = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(reset)) }))
        val pause = harness.run(listOf(user("сбрось"))).filterIsInstance<ChatEvent.ConfirmationRequired>().single()
        val check = harness.signer.verify(pause.confirmationToken, scope) as ConfirmationCheck.Valid
        // История подменена: у ожидающего вызова другие аргументы.
        val tampered = harness.run(listOf(user("сбрось"))).finalState().map { message ->
            message.copy(toolCalls = message.toolCalls.map { it.copy(arguments = args("appearanceId" to "evil")) })
        }
        harness.toolbox.executed.clear()

        val events = harness.run(tampered, ConfirmedOperation(check.operation, approved = true))

        val executed = harness.toolbox.executed.first()
        assertEquals("a1", (executed.arguments.getValue("appearanceId") as JsonPrimitive).content)
        assertEquals(
            check.operation.idempotencyKey,
            (executed.arguments.getValue("idempotencyKey") as JsonPrimitive).content,
        )
        assertEquals("draft-1", (executed.arguments.getValue("expectedDraftId") as JsonPrimitive).content)
        val recorded = events.finalState().first { message -> message.toolCalls.any { it.id == "c3" } }
        assertEquals(
            "a1",
            (recorded.toolCalls.single { it.id == "c3" }.arguments.getValue("appearanceId") as JsonPrimitive).content,
        )
    }

    @Test
    fun `rejected confirmation is not executed and reports user_rejected`() = runBlocking<Unit> {
        val harness = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(reset)) }, { LlmResponse.Text("ок") }))
        val pause = harness.run(listOf(user("сбрось"))).filterIsInstance<ChatEvent.ConfirmationRequired>().single()
        val check = harness.signer.verify(pause.confirmationToken, scope) as ConfirmationCheck.Valid
        harness.toolbox.executed.clear()

        val events = harness.run(listOf(user("сбрось")), ConfirmedOperation(check.operation, approved = false))

        assertTrue(harness.toolbox.executed.isEmpty())
        assertEquals("user_rejected", events.filterIsInstance<ChatEvent.ToolFinished>().single().code)
    }

    @Test
    fun `draft_changed backend code reaches the event`() = runBlocking<Unit> {
        val toolbox = FakeToolbox(
            results = mapOf(
                "component_property_set" to { call ->
                    ToolResult(call.id, call.name, "{}", true, code = "CONFLICT", backendCode = "draft_changed")
                },
            ),
        )
        val events = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(write)) }), toolbox).run(listOf(user("x")))

        val finished = events.filterIsInstance<ChatEvent.ToolFinished>().single()
        assertEquals("CONFLICT", finished.code)
        assertEquals("draft_changed", finished.backendCode)
    }

    @Test
    fun `write over the limit requires confirmation`() = runBlocking<Unit> {
        val second = write.copy(id = "c9")
        val harness =
            TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(write, second)) }), limits = limits(maxWrites = 1))
        val events = harness.run(listOf(user("x")))

        assertEquals(1, harness.toolbox.executed.size)
        assertEquals(
            ConfirmationReason.WRITE_LIMIT,
            events.filterIsInstance<ChatEvent.ConfirmationRequired>().single().reason,
        )
    }

    @Test
    fun `step limit ends the turn`() = runBlocking<Unit> {
        val events = TurnHarness(
            ScriptedLlm({ LlmResponse.ToolCalls(listOf(read)) }, { LlmResponse.ToolCalls(listOf(read)) }),
            limits = limits(maxSteps = 2),
        )
            .run(listOf(user("x")))

        assertEquals("step_limit_reached", events.filterIsInstance<ChatEvent.Error>().single().code)
        assertEquals(ChatEvent.Done, events.last())
    }

    @Test
    fun `turn timeout during a write lets the write finish and stops before the next step`() = runBlocking<Unit> {
        val toolbox = FakeToolbox(onExecute = { delay(50) })
        val harness = TurnHarness(
            ScriptedLlm({ LlmResponse.ToolCalls(listOf(write, write.copy(id = "c8"))) }),
            toolbox,
            limits(turnTimeout = 20.milliseconds),
        )
        val events = harness.run(listOf(user("x")))

        assertEquals(1, toolbox.executed.size)
        assertEquals("turn_timeout", events.filterIsInstance<ChatEvent.Error>().single().code)
        val assistant = events.finalState().last { it.role == ChatRole.ASSISTANT }
        assertEquals(listOf("c2"), assistant.toolCalls.map { it.id })
    }

    @Test
    fun `screen context reaches the model prompt but not the history`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ LlmResponse.Text("ok") })
        val context = com.dsbuilder.ai.chat.domain.ScreenContext(
            "components",
            component = com.dsbuilder.ai.chat.domain.ScreenComponent("Button", appearanceId = "a1"),
        )
        val events = TurnHarness(llm).run(listOf(user("сделай её красной")), context = context)

        assertTrue(""""name":"Button"""" in llm.requests.single().system)
        assertEquals(listOf("сделай её красной", "ok"), events.finalState().mapNotNull { it.text })
    }

    @Test
    fun `arguments outside the schema are rejected without execution`() = runBlocking<Unit> {
        val toolbox = FakeToolbox(invalidArguments = setOf("components_list"))
        val events = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(read)) }), toolbox).run(listOf(user("x")))

        assertTrue(toolbox.executed.isEmpty())
        assertEquals("invalid_arguments", events.filterIsInstance<ChatEvent.ToolFinished>().single().code)
    }

    @Test
    fun `unreadable draft gives backend unavailable instead of a confirmation`() = runBlocking<Unit> {
        val reset = ToolCall("c9", "component_property_reset", args("appearanceId" to "a1"))
        val toolbox = FakeToolbox(draftId = null)
        val events = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(reset)) }), toolbox).run(listOf(user("x")))

        assertTrue(events.none { it is ChatEvent.ConfirmationRequired })
        assertTrue(toolbox.executed.isEmpty())
        assertEquals("BACKEND_UNAVAILABLE", events.filterIsInstance<ChatEvent.ToolFinished>().single().code)
    }

    @Test
    fun `stop before the first step does not call the model`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ LlmResponse.Text("нет") })
        val harness = TurnHarness(llm)
        val events = harness.run(listOf(user("x"))) { turnId ->
            harness.store.stop(turnId, TurnOwner(scope.userId, scope.projectId))
        }

        assertTrue(llm.requests.isEmpty())
        assertEquals("stopped", events.filterIsInstance<ChatEvent.Error>().single().code)
    }

    @Test
    fun `stop before start still executes the confirmed operation`() = runBlocking<Unit> {
        val harness = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(reset)) }))
        val pause = harness.run(listOf(user("сбрось"))).filterIsInstance<ChatEvent.ConfirmationRequired>().single()
        val check = harness.signer.verify(pause.confirmationToken, scope) as ConfirmationCheck.Valid
        harness.toolbox.executed.clear()

        val events = harness.run(listOf(user("сбрось")), ConfirmedOperation(check.operation, true)) { turnId ->
            harness.store.stop(turnId, TurnOwner(scope.userId, scope.projectId))
        }

        assertEquals(listOf("component_property_reset"), harness.toolbox.executed.map { it.name })
        assertEquals("stopped", events.filterIsInstance<ChatEvent.Error>().single().code)
    }

    @Test
    fun `stop between calls of one model answer skips the rest`() = runBlocking<Unit> {
        lateinit var harness: TurnHarness
        var turnId = ""
        val toolbox = FakeToolbox(onExecute = { harness.store.stop(turnId, TurnOwner(scope.userId, scope.projectId)) })
        harness = TurnHarness(
            ScriptedLlm({ LlmResponse.ToolCalls(listOf(write, write.copy(id = "c7"), read)) }),
            toolbox,
        )
        val events = harness.run(listOf(user("x"))) { turnId = it }

        assertEquals(1, toolbox.executed.size)
        assertEquals(listOf("c2"), events.finalState().last { it.role == ChatRole.ASSISTANT }.toolCalls.map { it.id })
    }

    @Test
    fun `interrupted marker adds the rule and is removed after a model answer`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ LlmResponse.Text("проверил") })
        val events = TurnHarness(llm).run(listOf(user("a"), ChatMessage(ChatRole.INTERRUPTED), user("проверь")))

        assertTrue(SystemPrompt.INTERRUPTED_RULE in llm.requests.single().system)
        assertTrue(events.finalState().none { it.role == ChatRole.INTERRUPTED })
    }

    @Test
    fun `interrupted marker stays when the model never answered`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ throw LlmFailure.Unavailable("down") })
        val events = TurnHarness(llm).run(listOf(ChatMessage(ChatRole.INTERRUPTED), user("проверь")))

        assertEquals("llm_unavailable", events.filterIsInstance<ChatEvent.Error>().single().code)
        assertTrue(events.finalState().any { it.role == ChatRole.INTERRUPTED })
    }

    @Test
    fun `prompt without marker has no interrupted rule`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ LlmResponse.Text("ok") })
        TurnHarness(llm).run(listOf(user("x")))

        assertFalse(SystemPrompt.INTERRUPTED_RULE in llm.requests.single().system)
    }

    @Test
    fun `pending call without a decision gets not_confirmed before the model`() = runBlocking<Unit> {
        val llm = ScriptedLlm({ LlmResponse.Text("ok") })
        val history = listOf(
            user("сбрось"),
            ChatMessage(ChatRole.ASSISTANT, toolCalls = listOf(reset)),
            user("передумал"),
        )
        TurnHarness(llm).run(history)

        val sent = llm.requests.single().messages
        val result = sent.single { it.role == ChatRole.TOOL }.toolResult!!
        assertEquals("not_confirmed", result.code)
        assertEquals(ChatRole.ASSISTANT, sent[sent.indexOfFirst { it.role == ChatRole.TOOL } - 1].role)
    }

    @Test
    fun `unparseable arguments get invalid_arguments without execution`() = runBlocking<Unit> {
        val broken = ToolCall("c5", "components_list", args(ToolCall.INVALID_ARGUMENTS to "{name:"))
        val harness = TurnHarness(ScriptedLlm({ LlmResponse.ToolCalls(listOf(broken)) }))
        val events = harness.run(listOf(user("x")))

        assertTrue(harness.toolbox.executed.isEmpty())
        assertEquals("invalid_arguments", events.filterIsInstance<ChatEvent.ToolFinished>().single().code)
    }

    @Test
    fun `rate limit failure is reported`() = runBlocking<Unit> {
        val events = TurnHarness(ScriptedLlm({ throw LlmFailure.RateLimited("429") })).run(listOf(user("x")))

        assertEquals("llm_rate_limited", events.filterIsInstance<ChatEvent.Error>().single().code)
    }

    @Test
    fun `unexpected failure still ends with state done and frees the slot`() = runBlocking<Unit> {
        val harness = TurnHarness(ScriptedLlm({ error("boom") }))
        val events = harness.run(listOf(user("x")))

        assertEquals("internal_error", events.filterIsInstance<ChatEvent.Error>().single().code)
        assertEquals(ChatEvent.Done, events.last())
        val again = harness.store.register(
            TurnKeys(TurnOwner(scope.userId, scope.projectId), scope.designSystemId, "fresh", "fp", null),
            0,
        )
        assertIs<TurnRegistration.Started>(again)
    }
}
