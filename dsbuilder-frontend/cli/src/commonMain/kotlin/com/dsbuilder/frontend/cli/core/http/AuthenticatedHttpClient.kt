package com.dsbuilder.frontend.cli.core.http

import io.ktor.client.HttpClient
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
import io.ktor.http.isSuccess
import kotlinx.coroutines.runBlocking

private const val TRANSPORT_MESSAGE_LIMIT = 200

/**
 * Результат authenticated backend request.
 */
public sealed interface AuthenticatedHttpResult {
    /**
     * Backend вернул successful response.
     *
     * @property body response body как text.
     */
    public data class Success(
        public val body: String,
    ) : AuthenticatedHttpResult

    /**
     * Backend вернул user-facing failure без raw secret.
     *
     * @property message deterministic сообщение для CLI output.
     */
    public data class Failure(
        public val message: String,
    ) : AuthenticatedHttpResult
}

/**
 * Общая authenticated-обертка над HTTP client для project-scoped CLI-запросов.
 */
public interface AuthenticatedHttpClient {
    /**
     * Выполняет GET request относительно resolved API URL и добавляет `Authorization: ProjectKey <apiKey>`.
     */
    public fun get(path: String): AuthenticatedHttpResult

    /**
     * Выполняет POST request с JSON-телом относительно resolved API URL и добавляет
     * `Authorization: ProjectKey <apiKey>`.
     *
     * Ошибки backend отображаются так же, как у чтения.
     */
    public fun post(path: String, body: String): AuthenticatedHttpResult
}

/**
 * Factory для authenticated HTTP client.
 */
public fun interface AuthenticatedHttpClientFactory {
    /**
     * Создает authenticated client для runtime API URL и API key.
     */
    public fun create(
        apiUrl: String,
        apiKey: String,
    ): AuthenticatedHttpClient
}

/**
 * Ktor-реализация authenticated HTTP client.
 */
public class KtorAuthenticatedHttpClient(
    private val httpClient: HttpClient,
    private val apiUrl: String,
    private val apiKey: String,
) : AuthenticatedHttpClient {
    override fun get(path: String): AuthenticatedHttpResult = runBlocking {
        execute {
            httpClient.get(url(path)) {
                header(HttpHeaders.Authorization, "ProjectKey $apiKey")
            }
        }
    }

    override fun post(path: String, body: String): AuthenticatedHttpResult = runBlocking {
        execute {
            httpClient.post(url(path)) {
                header(HttpHeaders.Authorization, "ProjectKey $apiKey")
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }
    }

    /**
     * Транспортные отказы Ktor приходят типами конкретных движков — CIO и Darwin, — у которых нет
     * общего супертипа, видимого из `commonMain`. Без этого перехвата недоступный backend роняет
     * CLI необработанным исключением вместо детерминированного сообщения.
     */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun execute(request: suspend () -> HttpResponse): AuthenticatedHttpResult = try {
        request().toResult()
    } catch (exception: Exception) {
        AuthenticatedHttpResult.Failure("Status: failed. ${transportMessage(exception)}")
    }

    /**
     * Движки описывают отказ многострочно и подробно — сообщение Darwin занимает больше килобайта.
     * Для вывода CLI берётся первая строка и ограниченная длина.
     */
    private fun transportMessage(exception: Exception): String {
        val detail = exception.message
            ?.substringBefore('\n')
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?.take(TRANSPORT_MESSAGE_LIMIT)
            ?: return "Backend is unreachable."
        return "Backend is unreachable: $detail"
    }

    private suspend fun HttpResponse.toResult(): AuthenticatedHttpResult = when {
        status.isSuccess() -> AuthenticatedHttpResult.Success(bodyAsText())
        status == HttpStatusCode.Unauthorized -> AuthenticatedHttpResult.Failure(
            "Status: unauthorized. API key is missing or invalid.",
        )
        status == HttpStatusCode.Forbidden -> AuthenticatedHttpResult.Failure(
            "Status: forbidden. API key has no access to this project.",
        )
        status == HttpStatusCode.NotFound -> AuthenticatedHttpResult.Failure(
            "Status: not found. Project or resource was not found.",
        )
        else -> AuthenticatedHttpResult.Failure(
            "Status: failed. Backend returned HTTP ${status.value}.",
        )
    }

    private fun url(path: String): String = "${apiUrl.trimEnd('/')}/${path.trimStart('/')}"
}

/**
 * Factory для Ktor-backed authenticated HTTP client.
 */
public class KtorAuthenticatedHttpClientFactory(
    private val httpClientProvider: () -> HttpClient,
) : AuthenticatedHttpClientFactory {
    override fun create(
        apiUrl: String,
        apiKey: String,
    ): AuthenticatedHttpClient = KtorAuthenticatedHttpClient(
        httpClient = httpClientProvider(),
        apiUrl = apiUrl,
        apiKey = apiKey,
    )
}
