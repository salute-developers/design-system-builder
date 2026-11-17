package com.dsbuilder.ai.chat.application

import com.dsbuilder.ai.chat.domain.ChatEvent
import com.dsbuilder.ai.chat.domain.ChatMessage
import com.dsbuilder.ai.chat.domain.ChatScope
import com.dsbuilder.ai.chat.domain.LlmRequest
import com.dsbuilder.ai.chat.domain.LlmResponse
import com.dsbuilder.ai.chat.domain.ScreenContext
import com.dsbuilder.ai.chat.domain.StoredEvent
import com.dsbuilder.ai.chat.domain.ToolCall
import com.dsbuilder.ai.chat.domain.ToolResult
import com.dsbuilder.ai.chat.domain.ToolSpec
import com.dsbuilder.authorization.ProjectPrincipal
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonObject
import java.time.Instant
import kotlin.time.Duration

/** Порт провайдера модели; реализации живут в data. */
interface LlmClient {
    /** Выполняет один шаг модели; сбои провайдера — [com.dsbuilder.ai.chat.domain.LlmFailure]. */
    suspend fun complete(request: LlmRequest): LlmResponse
}

/** Действующие разрешения пользователя, вычисленные PolicyEvaluator из проверенного контекста. */
fun interface ChatAccess {
    /** Разрешено ли пользователю [permission]. */
    fun isAllowed(permission: String): Boolean
}

/** Вид операции инструмента чата. */
enum class ChatToolKind {
    /** Только чтение. */
    READ,

    /** Запись в черновик. */
    WRITE,

    /** Удаляющая запись; выполняется только после подтверждения пользователя. */
    DESTRUCTIVE,
}

/**
 * Описание инструмента чата для модели.
 *
 * @property name имя инструмента.
 * @property description описание для модели.
 * @property inputSchema JSON Schema аргументов без полей DS, версии, ключа и ожидаемого черновика.
 * @property permission точное разрешение, по которому инструмент отбирается.
 * @property kind вид операции.
 */
data class ChatToolDefinition(
    val name: String,
    val description: String,
    val inputSchema: JsonObject,
    val permission: String,
    val kind: ChatToolKind,
)

/**
 * Контекст вызова инструмента. Учётных данных пользователя не содержит.
 *
 * @property principal участник проекта из проверенного контекста запроса, начавшего ход.
 * @property designSystemId DS хода.
 * @property correlationId идентификатор корреляции вызова.
 * @property idempotencyKey ключ идемпотентности; только у записи.
 * @property expectedDraftId ожидаемый черновик; только у подтверждённой операции.
 */
data class ChatToolContext(
    val principal: ProjectPrincipal,
    val designSystemId: String,
    val correlationId: String,
    val idempotencyKey: String? = null,
    val expectedDraftId: String? = null,
)

/** Порт выполнения инструментов; в монолите его реализует адаптер к use case ds-service. */
interface ChatToolExecutor {
    /** Имена инструментов, для которых есть обработчик; сверяется с каталогом при запуске. */
    val supportedTools: Set<String>

    /** Выполняет инструмент [name] с проверенными по схеме [arguments]. */
    suspend fun execute(name: String, arguments: JsonObject, context: ChatToolContext): ToolResult

    /** Идентификатор активного черновика DS; null, если прочитать не удалось. */
    suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String): String?
}

/** Инструменты агента в конкретном ходе. */
interface AgentToolbox {
    /** Инструменты, доступные пользователю с [access]. */
    fun specs(access: ChatAccess): List<ToolSpec>

    /** Разрешён ли инструмент [name] пользователю с [access]. */
    fun isAllowed(name: String, access: ChatAccess): Boolean

    /** Записывает ли инструмент данные. */
    fun isWrite(name: String): Boolean

    /** Требует ли инструмент подтверждения сам по себе (удаление, сброс). */
    fun isDestructive(name: String): Boolean

    /** Отбрасывает поля, которые задаёт сервер; null — аргументы не проходят схему инструмента. */
    fun prepare(call: ToolCall): ToolCall?

    /** Выполняет вызов, ожидая результат не дольше таймаута вызова. */
    suspend fun execute(prepared: ToolCall, context: ChatToolContext): ToolResult

    /** Аргументы для событий интерфейса и истории. */
    fun visibleArguments(arguments: JsonObject): JsonObject

    /** Идентификатор активного черновика DS хода. */
    suspend fun activeDraftId(principal: ProjectPrincipal, designSystemId: String): String?
}

/** Результат проверки принадлежности DS проекту. */
enum class OwnershipCheck { OWNED, NOT_FOUND, FORBIDDEN, UNAVAILABLE }

/** Порт проверки принадлежности DS; в монолите реализуется существующим InProcessDesignSystemOwnership. */
fun interface DesignSystemOwnership {
    /** Проверяет DS [designSystemId] для принципала проверенного контекста. */
    suspend fun check(principal: ProjectPrincipal, designSystemId: String): OwnershipCheck
}

/**
 * Операция, ожидающая подтверждения: итоговые аргументы и ключ фиксируются сервером.
 *
 * @property callId идентификатор вызова модели.
 * @property tool имя инструмента.
 * @property arguments итоговые аргументы вызова.
 * @property idempotencyKey ключ идемпотентности операции.
 * @property draftId черновик DS, на котором выдано подтверждение.
 * @property scope область хода.
 * @property expiresAt момент истечения подтверждения.
 */
data class PendingOperation(
    val callId: String,
    val tool: String,
    val arguments: JsonObject,
    val idempotencyKey: String,
    val draftId: String,
    val scope: ChatScope,
    val expiresAt: Instant,
)

/** Результат проверки подписи подтверждения. */
sealed interface ConfirmationCheck {
    /**
     * Подпись, срок и область совпали.
     *
     * @property operation подтверждаемая операция.
     */
    data class Valid(val operation: PendingOperation) : ConfirmationCheck

    /** Неизвестный `kid` (процесс перезапускался) или срок прошёл. */
    data object Expired : ConfirmationCheck

    /** Подпись или область не совпали. */
    data object Invalid : ConfirmationCheck
}

/** Выпускает и проверяет подпись подтверждения; ключ и `kid` создаются при старте процесса. */
interface ConfirmationSigner {
    /** Подписывает операцию. */
    fun issue(operation: PendingOperation): String

    /** Проверяет токен для области текущего запроса. */
    fun verify(token: String, scope: ChatScope): ConfirmationCheck

    /** Хеш токена для связи подтверждения с ходом; сам токен в хранилище не попадает. */
    fun hash(token: String): String
}

/**
 * Владелец хода: только он читает и останавливает ход, и только в своём проекте.
 *
 * @property userId пользователь.
 * @property projectId проект.
 */
data class TurnOwner(val userId: String, val projectId: String)

/** Поиск уже принятого запроса. */
sealed interface TurnLookup {
    /**
     * Тот же ключ с тем же отпечатком либо тот же токен в той же области.
     *
     * @property turnId идентификатор найденного хода.
     */
    data class Existing(val turnId: String) : TurnLookup

    /** Тот же ключ с другим отпечатком тела. */
    data object KeyReused : TurnLookup

    /** Принятый токен из другой области. */
    data object ConfirmationScopeMismatch : TurnLookup

    /** Запрос новый. */
    data object NotFound : TurnLookup
}

/** Результат атомарной регистрации хода. */
sealed interface TurnRegistration {
    /**
     * Ход зарегистрирован.
     *
     * @property turnId идентификатор нового хода.
     */
    data class Started(val turnId: String) : TurnRegistration

    /**
     * Ключ или токен заняли между find и register.
     *
     * @property turnId идентификатор существующего хода.
     */
    data class Existing(val turnId: String) : TurnRegistration

    /**
     * У пользователя уже идёт ход.
     *
     * @property activeTurnId идентификатор идущего хода.
     * @property projectId проект идущего хода.
     * @property designSystemId DS идущего хода.
     */
    data class Busy(val activeTurnId: String, val projectId: String, val designSystemId: String) : TurnRegistration

    /** Параллельный запрос с тем же ключом и другим телом. */
    data object KeyReused : TurnRegistration

    /** Гонка с тем же токеном из другой области. */
    data object ConfirmationScopeMismatch : TurnRegistration

    /** Память занята идущими ходами. */
    data object Overloaded : TurnRegistration
}

/** Результат остановки хода. */
enum class StopResult { STOPPED, ALREADY_COMPLETED, UNKNOWN }

/** Результат подписки на события хода. */
sealed interface EventsResult {
    /**
     * Снимок после курсора и новые события.
     *
     * @property flow поток событий.
     * @property release освобождает слот потока.
     */
    data class Stream(val flow: Flow<StoredEvent>, val release: () -> Unit) : EventsResult

    /** Ход неизвестен, вытеснен или чужой. */
    data object Unknown : EventsResult

    /** У пользователя уже открыто максимальное число потоков. */
    data object TooManyStreams : EventsResult
}

/**
 * Ключи связи запроса с ходом.
 *
 * @property owner владелец хода.
 * @property designSystemId DS запроса.
 * @property idempotencyKey ключ идемпотентности запроса.
 * @property fingerprint отпечаток тела запроса.
 * @property confirmationTokenHash хеш токена подтверждения, если он есть.
 */
data class TurnKeys(
    val owner: TurnOwner,
    val designSystemId: String,
    val idempotencyKey: String,
    val fingerprint: String,
    val confirmationTokenHash: String?,
)

/**
 * Ходы в памяти процесса. Связи ключа и хеша токена с ходом хранятся отдельно от событий
 * и по объёму не вытесняются. Объём — байты UTF-8 сериализованных событий и входной истории.
 */
interface TurnStore {
    /** Ищет уже принятый запрос по ключу и хешу токена. */
    fun find(keys: TurnKeys): TurnLookup

    /** Атомарно: повторная сверка ключа и хеша, слот пользователя, предел памяти, запись хода. */
    fun register(keys: TurnKeys, inputBytes: Long): TurnRegistration

    /** Освобождает слот, удаляет ход и связи ключа и хеша токена, если запуск не удался. */
    fun cancelRegistration(turnId: String)

    /** Сохраняет событие и только потом отдаёт его подписчикам. */
    fun append(turnId: String, event: ChatEvent, bytes: Long): StoredEvent

    /** Завершает ход и освобождает слот пользователя; вызывается в finally. */
    fun complete(turnId: String)

    /** Запрошена ли остановка хода. */
    fun isStopRequested(turnId: String): Boolean

    /** Снимок после [afterId] и подписка на новые события под одной блокировкой хода. */
    fun events(turnId: String, owner: TurnOwner, afterId: Long?): EventsResult

    /** Запрашивает остановку хода. */
    fun stop(turnId: String, owner: TurnOwner): StopResult
}

/**
 * Ограничения хода из конфигурации.
 *
 * @property maxSteps предел шагов модели.
 * @property maxWrites предел записей без подтверждения.
 * @property turnTimeout таймаут хода.
 * @property historyMaxChars предел истории в символах.
 * @property messageMaxChars предел одной реплики в символах.
 * @property toolResultMaxChars предел результата инструмента в символах.
 * @property toolCallTimeout таймаут вызова инструмента.
 * @property turnStoreMaxBytes предел памяти хранилища ходов в байтах.
 */
data class AgentLimits(
    val maxSteps: Int,
    val maxWrites: Int,
    val turnTimeout: Duration,
    val historyMaxChars: Int,
    val messageMaxChars: Int,
    val toolResultMaxChars: Int,
    val toolCallTimeout: Duration,
    val turnStoreMaxBytes: Long,
)

/**
 * Решение пользователя по подтверждению.
 *
 * @property confirmationToken токен подтверждения.
 * @property approved пользователь одобрил операцию.
 */
data class ToolConfirmation(val confirmationToken: String, val approved: Boolean)

/**
 * Разобранное тело POST `/ai/chat`.
 *
 * @property idempotencyKey ключ идемпотентности.
 * @property designSystemId DS хода.
 * @property messages история разговора.
 * @property confirmations решения по подтверждениям.
 * @property context что открыто в редакторе; в историю не сохраняется.
 */
data class ChatTurnRequest(
    val idempotencyKey: String,
    val designSystemId: String,
    val messages: List<ChatMessage>,
    val confirmations: List<ToolConfirmation>,
    val context: ScreenContext? = null,
)

/**
 * Подтверждённая операция вместе с решением пользователя.
 *
 * @property operation операция.
 * @property approved пользователь одобрил операцию.
 */
data class ConfirmedOperation(val operation: PendingOperation, val approved: Boolean)

/**
 * Команда выполнения хода.
 *
 * @property turnId идентификатор хода.
 * @property scope область хода.
 * @property principal участник проекта из проверенного контекста POST.
 * @property access разрешения пользователя.
 * @property messages история разговора.
 * @property confirmed подтверждённая операция, если есть.
 * @property context что открыто в редакторе.
 */
data class ChatTurnCommand(
    val turnId: String,
    val scope: ChatScope,
    val principal: ProjectPrincipal,
    val access: ChatAccess,
    val messages: List<ChatMessage>,
    val confirmed: ConfirmedOperation?,
    val context: ScreenContext? = null,
)
