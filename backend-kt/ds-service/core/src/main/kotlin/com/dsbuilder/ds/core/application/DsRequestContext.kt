package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/**
 * Доверенный режим доступа и метаданные предметного запроса.
 *
 * @property access Проектные полномочия либо адресный публичный кандидат без principal.
 * @property correlationId Идентификатор запроса для диагностики.
 */
data class DsRequestContext(
    val access: DsAccessContext,
    val correlationId: String,
    /** Техническая редакция, на которой пользователь начал изменение. */
    val baseRevision: Long? = null,
    /** Необязательная опубликованная граница предметного чтения. */
    val versionId: UUID? = null,
    /** Идентификатор вкладки редактора для исключения собственного SSE-события. */
    val clientId: String? = null,
    /** Кодирует публичное тело первого ответа для точного повтора ключа. */
    val idempotentResponseEncoder: ((Any) -> String)? = null,
    /** Повторяемая предметная команда, выполняемая в одной транзакции с сохранением её результата. */
    val mutationRequest: IdempotentMutationRequest? = null,
    /** Точный номер версии либо draft; разрешается в транзакции предметного чтения. */
    val version: String? = null,
    /** Проверенные фильтры и параметры необязательной страницы. */
    val readQuery: ModelReadQuery = ModelReadQuery(),
    /** Ожидаемая система из пути; отсутствует у глобальной операции. */
    val designSystemId: UUID? = null,
    /** Черновик, в который должна попасть запись; при смене активного черновика запись отклоняется. */
    val expectedDraftId: UUID? = null,
    /** Ожидаемая ревизия выбора Core при согласованной записи. */
    val expectedCoreSelectionRevision: Long? = null,
) {
    /** Совместимый вход только для настоящих проектных полномочий. */
    constructor(
        principal: ProjectPrincipal,
        correlationId: String,
        baseRevision: Long? = null,
        versionId: UUID? = null,
        clientId: String? = null,
        idempotentResponseEncoder: ((Any) -> String)? = null,
        mutationRequest: IdempotentMutationRequest? = null,
        version: String? = null,
        readQuery: ModelReadQuery = ModelReadQuery(),
        designSystemId: UUID? = null,
        expectedDraftId: UUID? = null,
        expectedCoreSelectionRevision: Long? = null,
    ) : this(
        ProjectAccess(principal),
        correlationId,
        baseRevision,
        versionId,
        clientId,
        idempotentResponseEncoder,
        mutationRequest,
        version,
        readQuery,
        designSystemId,
        expectedDraftId,
        expectedCoreSelectionRevision,
    )

    /** Настоящий principal доступен только проектным сценариям, не создаётся для гостя. */
    val principal: ProjectPrincipal get() = requireNotNull((access as? ProjectAccess)?.principal)

    /** Проверенный адрес публичной попытки, без проектных полномочий. */
    val publicRead: PublicReadCandidate? get() = access as? PublicReadCandidate

    /** Представление режима для метаданных после успешной транзакционной проверки. */
    val accessMode: String get() = if (publicRead == null) "project" else "public"

    /** Проект выбранного режима доступа. */
    val projectId: ProjectId get() = access.projectId

    /** Публичный кандидат не получает административных прав. */
    val globalAdmin: Boolean get() = (access as? ProjectAccess)?.principal?.globalAdmin == true

    /** Актор доступен только проектной команде. */
    val actorId: String get() = principal.actorId

    /** Публиковать preview может только проектный актор. */
    val composePreviewPublisher: Boolean get() =
        (access as? ProjectAccess)?.principal?.composePreviewPublisher == true

    init {
        require(publicRead == null || designSystemId == publicRead?.designSystemId)
    }
}

/** Adds a presentation-owned response encoder without coupling application code to HTTP DTOs. */
@Suppress("UNCHECKED_CAST")
fun <T : Any> DsRequestContext.withIdempotentResponse(encoder: (T) -> String): DsRequestContext = copy(
    idempotentResponseEncoder = { value -> encoder(value as T) },
)

/** Уточняет фиксированное имя предметной команды ожидаемой системой запроса. */
fun DsRequestContext.scopedOperation(operation: String): String =
    designSystemId?.let { "$operation|design-system:$it" } ?: operation
