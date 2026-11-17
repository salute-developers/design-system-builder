package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.data.HmacConfirmationSigner
import com.dsbuilder.ai.chat.data.InMemoryTurnStore
import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.seconds

class StartChatTurnUseCaseTest {
    private val principal = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", projectRole = "editor")
    private val owner = TurnOwner(scope.userId, scope.projectId)

    private inner class Harness(
        ownership: OwnershipCheck = OwnershipCheck.OWNED,
        llm: LlmClient = ScriptedLlm({ LlmResponse.Text("ok") }),
        val toolbox: FakeToolbox = FakeToolbox(),
        clock: Clock = Clock.systemUTC(),
    ) {
        val store = InMemoryTurnStore(64L * 1024 * 1024)
        val signer = HmacConfirmationSigner(clock, "kid", ByteArray(32))
        val turnScope = ChatTurnScope(Dispatchers.Default)
        val runner = RunChatTurnUseCase(llm, toolbox, signer, store, limits(), clock)
        val useCase = StartChatTurnUseCase(store, { _, _ -> ownership }, signer, runner, turnScope)

        suspend fun start(request: ChatTurnRequest) = useCase.start(request, scope, principal, allowAll)

        suspend fun events(turnId: String): List<ChatEvent> = withTimeout(5_000) {
            val stream = store.events(turnId, owner, null) as EventsResult.Stream
            stream.flow.toList().map { it.event }.also { stream.release() }
        }
    }

    private fun request(
        key: String = "k1",
        confirmations: List<ToolConfirmation> = emptyList(),
        messages: List<ChatMessage> = listOf(user("x")),
    ) =
        ChatTurnRequest(key, scope.designSystemId, messages, confirmations)

    private fun StartResult.code() = (this as StartResult.Rejected).rejection.code
    private fun StartResult.status() = (this as StartResult.Rejected).rejection.status

    @Test
    fun acceptedTurnRunsAndRepeatWithSameKeyReturnsSameTurn() = runBlocking<Unit> {
        val harness = Harness()
        val first = harness.start(request()) as StartResult.Accepted
        assertEquals(ChatEvent.Done, harness.events(first.turnId).last())

        assertEquals(first, harness.start(request()))
        assertEquals("IDEMPOTENCY_KEY_REUSED", harness.start(request(messages = listOf(user("другое")))).code())
    }

    @Test
    fun ownershipResultsMapToStatuses() = runBlocking<Unit> {
        assertEquals(404, Harness(OwnershipCheck.NOT_FOUND).start(request()).status())
        assertEquals("design_system_forbidden", Harness(OwnershipCheck.FORBIDDEN).start(request()).code())
        val unavailable = Harness(OwnershipCheck.UNAVAILABLE).start(request())
        assertEquals(503, unavailable.status())
        assertEquals("dependency_unavailable", unavailable.code())
    }

    @Test
    fun rejectedRequestLeavesNoSlot() = runBlocking<Unit> {
        val harness = Harness(OwnershipCheck.NOT_FOUND)
        harness.start(request())
        val registration = harness.store.register(TurnKeys(owner, scope.designSystemId, "fresh", "fp", null), 0)
        assertIs<TurnRegistration.Started>(registration)
    }

    @Test
    fun busyUserGetsActiveTurnDetails() = runBlocking<Unit> {
        val gate = CompletableDeferred<Unit>()
        val harness = Harness(
            llm = object : LlmClient {
                override suspend fun complete(request: com.dsbuilder.ai.chat.domain.LlmRequest): LlmResponse {
                    gate.await()
                    return LlmResponse.Text("ok")
                }
            },
        )
        val first = harness.start(request()) as StartResult.Accepted
        val busy = harness.start(request(key = "k2")) as StartResult.Rejected

        assertEquals(429, busy.rejection.status)
        assertEquals(first.turnId, busy.rejection.details["activeTurnId"])
        assertEquals(scope.designSystemId, busy.rejection.details["designSystemId"])
        gate.complete(Unit)
        harness.events(first.turnId)
    }

    @Test
    fun confirmationTokenChecksAndReplayAfterExpiry() = runBlocking<Unit> {
        var now = Instant.parse("2026-11-17T10:00:00Z")
        val clock = object : Clock() {
            override fun getZone() = ZoneOffset.UTC
            override fun withZone(zone: java.time.ZoneId?) = this
            override fun instant() = now
        }
        val reset = ToolCall("c3", "component_property_reset", args("appearanceId" to "a1"))
        val harness = Harness(
            llm = ScriptedLlm({ LlmResponse.ToolCalls(listOf(reset)) }, { LlmResponse.Text("ok") }),
            clock = clock,
        )
        val paused = harness.start(request()) as StartResult.Accepted
        val events = harness.events(paused.turnId)
        val token = events.filterIsInstance<ChatEvent.ConfirmationRequired>().single().confirmationToken
        val history = events.filterIsInstance<ChatEvent.State>().last().messages
        val confirm = request(key = "k2", confirmations = listOf(ToolConfirmation(token, true)), messages = history)

        val accepted = harness.start(confirm) as StartResult.Accepted
        harness.events(accepted.turnId)
        assertEquals(listOf("component_property_reset"), harness.toolbox.executed.map { it.name })

        // Другая вкладка с тем же токеном и другим ключом получает тот же ход.
        assertEquals(accepted, harness.start(confirm.copy(idempotencyKey = "k3")))
        // После истечения токена повтор принятого подтверждения всё равно получает прежний ход.
        now = now.plusSeconds(11 * 60 - 1)
        assertEquals(accepted, harness.start(confirm.copy(idempotencyKey = "k4")))
        assertEquals(1, harness.toolbox.executed.size)

        val foreign = harness.useCase.start(
            confirm.copy(idempotencyKey = "k5", designSystemId = "ds-2"),
            scope.copy(designSystemId = "ds-2"),
            principal,
            allowAll,
        )
        assertEquals("confirmation_invalid", foreign.code())
    }

    @Test
    fun expiredAndForgedTokensAreRejected() = runBlocking<Unit> {
        val harness = Harness()
        val other = HmacConfirmationSigner(Clock.systemUTC())
        val foreignKid = other.issue(
            PendingOperation("c", "component_property_reset", args(), "k", "d", scope, Instant.now().plusSeconds(60)),
        )
        val expired = harness.start(
            request(
                confirmations = listOf(ToolConfirmation(foreignKid, true)),
                messages = listOf(ChatMessage(ChatRole.ASSISTANT)),
            ),
        )
        assertEquals(410, expired.status())
        val forged = harness.start(request(key = "k2", confirmations = listOf(ToolConfirmation("garbage.token", true))))
        assertEquals("confirmation_invalid", forged.code())
    }

    @Test
    fun stoppedScopeRejectsAndFreesTheSlot() = runBlocking<Unit> {
        val harness = Harness()
        harness.turnScope.shutdown(1.seconds)
        val rejected = harness.start(request())

        assertEquals("ai_unavailable", rejected.code())
        assertIs<TurnRegistration.Started>(
            harness.store.register(TurnKeys(owner, scope.designSystemId, "k1", "fp", null), 0),
        )
    }

    @Test
    fun cancellingTheCallerDoesNotCancelTheTurnAndShutdownWaitsForTheTool() = runBlocking<Unit> {
        val toolStarted = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val write = ToolCall("c2", "component_property_set", args("appearanceId" to "a1"))
        val toolbox = FakeToolbox(onExecute = {
            toolStarted.complete(Unit)
            release.await()
        })
        val harness = Harness(llm = ScriptedLlm({ LlmResponse.ToolCalls(listOf(write)) }), toolbox = toolbox)
        var turnId = ""
        val caller = launch { turnId = (harness.start(request()) as StartResult.Accepted).turnId }
        caller.join()
        toolStarted.await()
        caller.cancel()

        val shutdown = launch { harness.turnScope.shutdown(5.seconds) }
        release.complete(Unit)
        shutdown.join()
        assertEquals(1, toolbox.executed.size)
        assertTrue(harness.events(turnId).any { it is ChatEvent.ToolFinished })
    }
}
