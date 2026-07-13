package com.dsbuilder.frontend.cli.core.http

import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.runBlocking

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
public fun interface AuthenticatedHttpClient {
    /**
     * Выполняет GET request относительно resolved API URL и добавляет `Authorization: ProjectKey <apiKey>`.
     */
    public fun get(path: String): AuthenticatedHttpResult
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
        val response = httpClient.get(url(path)) {
            header(HttpHeaders.Authorization, "ProjectKey $apiKey")
        }

        when {
            response.status.isSuccess() -> AuthenticatedHttpResult.Success(response.bodyAsText())
            response.status == HttpStatusCode.Unauthorized -> AuthenticatedHttpResult.Failure(
                "Status: unauthorized. API key is missing or invalid.",
            )
            response.status == HttpStatusCode.Forbidden -> AuthenticatedHttpResult.Failure(
                "Status: forbidden. API key has no access to this project.",
            )
            response.status == HttpStatusCode.NotFound -> AuthenticatedHttpResult.Failure(
                "Status: not found. Project or resource was not found.",
            )
            else -> AuthenticatedHttpResult.Failure(
                "Status: failed. Backend returned HTTP ${response.status.value}.",
            )
        }
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
