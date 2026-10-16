package com.dsbuilder.ds.core.application

import com.dsbuilder.authorization.ProjectPrincipal
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/**
 * Trusted actor and request metadata shared by application use cases.
 *
 * @property principal principal created by authorization-core from trusted headers
 * @property correlationId request correlation identifier
 */
data class DsRequestContext(
    val principal: ProjectPrincipal,
    val correlationId: String,
    /** Техническая редакция, на которой пользователь начал изменение. */
    val baseRevision: Long? = null,
    /** Необязательная опубликованная граница предметного чтения. */
    val versionId: UUID? = null,
    /** Идентификатор вкладки редактора для исключения собственного SSE-события. */
    val clientId: String? = null,
    /** Кодирует публичное тело первого ответа для точного повтора ключа. */
    val idempotentResponseEncoder: ((Any) -> String)? = null,
) {
    /** Project boundary derived exclusively from [principal]. */
    val projectId: ProjectId = ProjectId(principal.projectId)
}

/** Adds a presentation-owned response encoder without coupling application code to HTTP DTOs. */
@Suppress("UNCHECKED_CAST")
fun <T : Any> DsRequestContext.withIdempotentResponse(encoder: (T) -> String): DsRequestContext = copy(
    idempotentResponseEncoder = { value -> encoder(value as T) },
)
