package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.data.HmacConfirmationSigner
import com.dsbuilder.ai.chat.data.InMemoryTurnStore
import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatRole
import com.dsbuilder.ai.chat.domain.ChatScope
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ScreenContext
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ai.chat.domain.ToolSpec
import com.dsbuilder.authorization.ProjectActorType
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.flow.toList
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

internal val scope = ChatScope("user-1", "project-1", "ds-1")

internal val principal = ProjectPrincipal(ProjectActorType.USER, "user-1", "project-1", "editor")

internal fun limits(
    maxSteps: Int = 6,
    maxWrites: Int = 10,
    turnTimeout: Duration = 2.minutes,
    historyMaxChars: Int = 60_000,
) = AgentLimits(
    maxSteps = maxSteps,
    maxWrites = maxWrites,
    turnTimeout = turnTimeout,
    historyMaxChars = historyMaxChars,
    messageMaxChars = 8_000,
    toolResultMaxChars = 6_000,
    toolCallTimeout = 30.seconds,
    turnStoreMaxBytes = 64L * 1024 * 1024,
)

internal fun args(vararg pairs: Pair<String, String>) =
    JsonObject(pairs.associate { it.first to JsonPrimitive(it.second) })

internal fun user(text: String) = ChatMessage(ChatRole.USER, text = text)

/** Модель, отвечающая по сценарию; запоминает запросы. */
internal class ScriptedLlm(private vararg val steps: () -> LlmResponse) : LlmClient {
    val requests = mutableListOf<LlmRequest>()
    override suspend fun complete(request: LlmRequest): LlmResponse {
        requests += request
        return steps.getOrNull(requests.size - 1)?.invoke() ?: LlmResponse.Text("готово")
    }
}

/** Инструменты с заданными признаками; вызовы записываются. */
internal class FakeToolbox(
    private val writes: Set<String> = setOf("component_property_set", "token_value_update"),
    private val destructive: Set<String> = setOf("component_property_reset"),
    private val allowed: Set<String> = setOf(
        "components_list",
        "component_property_set",
        "component_property_reset",
        "token_value_update",
    ),
    private val results: Map<String, (ToolCall) -> ToolResult> = emptyMap(),
    var draftId: String? = "draft-1",
    private val invalidArguments: Set<String> = emptySet(),
    private val onExecute: suspend (ToolCall) -> Unit = {},
) : AgentToolbox {
    val executed = mutableListOf<ToolCall>()
    val contexts = mutableListOf<ChatToolContext>()

    override fun specs(access: ChatAccess) = allowed.map { ToolSpec(it, it, JsonObject(emptyMap())) }
    override fun isAllowed(name: String, access: ChatAccess) = name in allowed
    override fun isWrite(name: String) = name in writes || name in destructive
    override fun isDestructive(name: String) = name in destructive
    override fun prepare(call: ToolCall): ToolCall? =
        if (call.name in invalidArguments) null else call.copy(arguments = visibleArguments(call.arguments))

    /** Записывает вызов с ключом и ожидаемым черновиком из контекста в аргументах, чтобы их было видно в проверках. */
    override suspend fun execute(prepared: ToolCall, context: ChatToolContext): ToolResult {
        onExecute(prepared)
        contexts += context
        executed += prepared.copy(
            arguments = JsonObject(
                prepared.arguments + mapOfNotNull(
                    context.idempotencyKey?.let { "idempotencyKey" to JsonPrimitive(it) },
                    context.expectedDraftId?.let { "expectedDraftId" to JsonPrimitive(it) },
                ),
            ),
        )
        return results[prepared.name]?.invoke(prepared)
            ?: ToolResult(prepared.id, prepared.name, """{"ok":true}""", false)
    }

    override fun visibleArguments(arguments: JsonObject) =
        JsonObject(arguments.filterKeys { it != "idempotencyKey" && it != "expectedDraftId" })

    override suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String) = draftId

    private fun <K, V> mapOfNotNull(vararg pairs: Pair<K, V>?): Map<K, V> = pairs.filterNotNull().toMap()
}

internal val allowAll = ChatAccess { true }

/** Запускает ход и возвращает его события. */
internal class TurnHarness(
    val llm: LlmClient,
    val toolbox: FakeToolbox = FakeToolbox(),
    val limits: AgentLimits = limits(),
) {
    val store = InMemoryTurnStore(limits.turnStoreMaxBytes)
    val signer = HmacConfirmationSigner()
    private var keys = 0
    private var registrations = 0
    val runner = RunChatTurnUseCase(llm, toolbox, signer, store, limits, newKey = { "key-${++keys}" })

    suspend fun run(
        messages: List<ChatMessage>,
        confirmed: ConfirmedOperation? = null,
        context: ScreenContext? = null,
        beforeRun: (String) -> Unit = {},
    ): List<ChatEvent> {
        val registration = store.register(
            TurnKeys(
                TurnOwner(scope.userId, scope.projectId),
                scope.designSystemId,
                "idem-${registrations++}",
                "fp",
                null,
            ),
            0,
        ) as TurnRegistration.Started
        beforeRun(registration.turnId)
        runner.run(ChatTurnCommand(registration.turnId, scope, principal, allowAll, messages, confirmed, context))
        val stream =
            store.events(registration.turnId, TurnOwner(scope.userId, scope.projectId), null) as EventsResult.Stream
        return stream.flow.toList().map { it.event }.also { stream.release() }
    }
}

internal fun List<ChatEvent>.finalState(): List<ChatMessage> = filterIsInstance<ChatEvent.State>().last().messages
