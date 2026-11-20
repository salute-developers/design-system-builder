package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.BackendCredential
import io.ktor.client.HttpClient
import io.ktor.client.plugins.expectSuccess
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.coroutines.CancellationException

/** Поддерживаемые методы предметных мутаций. */
public enum class MutationHttpMethod { POST, PUT, PATCH, DELETE }

/** Исходная команда HTTP, повторяемая с тем же ключом и телом. */
public data class HttpMutationRequest(
    /** Метод HTTP. */
    public val method: MutationHttpMethod,
    /** Путь относительно API URL с параметрами запроса. */
    public val path: String,
    /** Исходное JSON-тело или отсутствие тела. */
    public val body: String?,
    /** Исходный ключ повторяемости команды. */
    public val idempotencyKey: String,
    /** Базовая предметная редакция для конкурентной записи. */
    public val baseRevision: Long? = null,
    /** Идентификатор клиента для метаданных записи. */
    public val clientId: String? = null,
) {
    init {
        require(idempotencyKey.isNotBlank()) { "idempotencyKey is required." }
        require(baseRevision == null || baseRevision >= 0) { "baseRevision must be non-negative." }
    }
}

/** Полученный HTTP-ответ либо неизвестный результат отправленной команды. */
public sealed interface HttpMutationResult {
    /** Тело и разрешённые метаданные передаются предметному адаптеру. */
    public data class Response(
        /** Полученный числовой статус HTTP. */
        public val statusCode: Int,
        /** Исходное JSON-тело или отсутствие тела. */
        public val body: String,
        /** Разрешённые однозначные заголовки в нижнем регистре. */
        public val headers: Map<String, String>,
        /** Все разрешённые заголовки однозначны. */
        public val metadataValid: Boolean,
        /** Исходные подтверждающие чтения после усечения метаданных. */
        public val confirmedReads: Map<String, String> = emptyMap(),
        /** Была попытка перечитать подтверждённые данные. */
        public val confirmationAttempted: Boolean = false,
        /** Хотя бы одно подтверждающее чтение недоступно. */
        public val confirmationIncomplete: Boolean = false,
    ) : HttpMutationResult

    /** При сетевом сбое исход записи неизвестен. Ключ пригоден для повтора той же команды. */
    public data class OutcomeUnknown(
        /** Исходный ключ повторяемости команды. */
        public val idempotencyKey: String,
    ) : HttpMutationResult
}

private val mutationHeaders = setOf(
    "x-ds-mutation-metadata",
    "x-ds-mutation-metadata-truncated",
    "x-ds-read-context",
)

@Suppress("TooGenericExceptionCaught")
internal suspend fun executeMutation(
    client: HttpClient,
    url: String,
    credential: BackendCredential,
    command: HttpMutationRequest,
): HttpMutationResult = try {
    val response = client.request(url) {
        expectSuccess = false
        method = HttpMethod.parse(command.method.name)
        header(HttpHeaders.Authorization, credential.authorizationValue())
        header("Idempotency-Key", command.idempotencyKey)
        command.baseRevision?.let { header("X-DS-Base-Revision", it) }
        command.clientId?.let { header("X-DS-Client-Id", it) }
        command.body?.let {
            contentType(ContentType.Application.Json)
            setBody(it)
        }
    }
    HttpMutationResult.Response(
        response.status.value,
        response.bodyAsText().let { body -> if (response.status.value >= 400) body.redact(credential) else body },
        response.headers.safeEditorHeaders(mutationHeaders),
        response.headers.unambiguousEditorHeaders(mutationHeaders),
    )
} catch (exception: CancellationException) {
    throw exception
} catch (exception: Exception) {
    HttpMutationResult.OutcomeUnknown(command.idempotencyKey)
}

private fun String.redact(credential: BackendCredential): String {
    val secret = credential.secretValue()
    return if (secret.isEmpty()) this else replace(secret, "[redacted]")
}

/** Одно представление учётных данных для всех HTTP-операций. */
internal fun BackendCredential.secretValue(): String = when (this) {
    is BackendCredential.PersonalAccessToken -> value
    is BackendCredential.Bearer -> accessToken
    is BackendCredential.ServiceToken -> accessToken
}

internal fun BackendCredential.authorizationValue(): String {
    return "Bearer ${secretValue()}"
}

/** Сохраняет только однозначные заголовки из разрешённого набора. */
internal fun Headers.safeEditorHeaders(names: Set<String>): Map<String, String> =
    names.mapNotNull { name -> getAll(name)?.singleOrNull()?.let { name to it } }.toMap()

internal fun Headers.unambiguousEditorHeaders(names: Set<String>): Boolean =
    names.none { getAll(it).orEmpty().size > 1 }
