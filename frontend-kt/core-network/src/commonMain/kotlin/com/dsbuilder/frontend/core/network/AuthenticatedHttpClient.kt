package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.BackendCredential
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentDisposition
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.isSuccess

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
     * @property statusCode numeric HTTP status, or null for a transport failure.
     */
    public data class Failure(
        public val message: String,
        public val statusCode: Int? = null,
    ) : AuthenticatedHttpResult
}

/**
 * Файл для authenticated multipart request.
 *
 * @property partName имя multipart part.
 * @property fileName имя отправляемого файла.
 * @property contentType media type файла.
 * @property bytes содержимое файла.
 */
public data class MultipartFile(
    public val partName: String,
    public val fileName: String,
    public val contentType: String,
    public val bytes: ByteArray,
)

/**
 * Нормализованный HTTP response для feature-specific mapping.
 *
 * @property statusCode числовой HTTP status.
 * @property body response body.
 */
public data class AuthenticatedHttpResponse(
    public val statusCode: Int,
    public val body: String,
)

/**
 * Общая authenticated-обертка над HTTP client для project-scoped CLI-запросов.
 */
public interface AuthenticatedHttpClient {
    /**
     * Выполняет GET request относительно resolved API URL и добавляет `Authorization: ProjectKey <apiKey>`.
     */
    public suspend fun get(path: String): AuthenticatedHttpResult

    /**
     * Выполняет POST request с JSON-телом относительно resolved API URL и добавляет
     * `Authorization: ProjectKey <apiKey>`.
     *
     * Ошибки backend отображаются так же, как у чтения.
     */
    public suspend fun post(path: String, body: String): AuthenticatedHttpResult

    /** Выполняет multipart POST с project API key. */
    public suspend fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse =
        error("Multipart POST is not supported by this client.")
}

/**
 * Factory для authenticated HTTP client.
 */
public interface AuthenticatedHttpClientFactory {
    /**
     * Создает authenticated client для runtime API URL и legacy project API key call sites.
     */
    public fun create(
        apiUrl: String,
        apiKey: String,
    ): AuthenticatedHttpClient

    /**
     * Создает authenticated client для runtime API URL и выбранного credential.
     */
    public fun create(
        apiUrl: String,
        credential: BackendCredential,
    ): AuthenticatedHttpClient =
        when (credential) {
            is BackendCredential.ProjectKey -> create(apiUrl, credential.value)
            is BackendCredential.Bearer -> error("Bearer credentials are not supported by this client.")
        }
}

/**
 * Ktor-реализация authenticated HTTP client.
 */
public class KtorAuthenticatedHttpClient(
    private val httpClient: HttpClient,
    private val apiUrl: String,
    private val credential: BackendCredential,
) : AuthenticatedHttpClient {
    override suspend fun get(path: String): AuthenticatedHttpResult =
        execute {
            httpClient.get(url(path)) {
                authorizationHeader()
            }
        }

    override suspend fun post(path: String, body: String): AuthenticatedHttpResult =
        execute {
            httpClient.post(url(path)) {
                authorizationHeader()
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }

    override suspend fun postMultipart(path: String, file: MultipartFile): AuthenticatedHttpResponse {
        val response = httpClient.post(url(path)) {
            authorizationHeader()
            setBody(
                MultiPartFormDataContent(
                    formData {
                        append(
                            file.partName,
                            file.bytes,
                            Headers.build {
                                append(HttpHeaders.ContentType, file.contentType)
                                append(
                                    HttpHeaders.ContentDisposition,
                                    ContentDisposition.File.withParameter(
                                        ContentDisposition.Parameters.FileName,
                                        file.fileName,
                                    ).toString(),
                                )
                            },
                        )
                    },
                ),
            )
        }
        return AuthenticatedHttpResponse(response.status.value, response.bodyAsText())
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
            "Status: unauthorized. Credential is missing or invalid.",
            status.value,
        )
        status == HttpStatusCode.Forbidden -> AuthenticatedHttpResult.Failure(
            "Status: forbidden. Credential has no access to this project.",
            status.value,
        )
        status == HttpStatusCode.NotFound -> AuthenticatedHttpResult.Failure(
            "Status: not found. Project or resource was not found.",
            status.value,
        )
        else -> AuthenticatedHttpResult.Failure(
            "Status: failed. Backend returned HTTP ${status.value}.",
            status.value,
        )
    }

    private fun url(path: String): String = "${apiUrl.trimEnd('/')}/${path.trimStart('/')}"

    private fun io.ktor.client.request.HttpRequestBuilder.authorizationHeader() {
        val value = when (credential) {
            is BackendCredential.Bearer -> "Bearer ${credential.accessToken}"
            is BackendCredential.ProjectKey -> "ProjectKey ${credential.value}"
        }
        header(HttpHeaders.Authorization, value)
    }
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
    ): AuthenticatedHttpClient = create(apiUrl, BackendCredential.ProjectKey(apiKey))

    override fun create(
        apiUrl: String,
        credential: BackendCredential,
    ): AuthenticatedHttpClient = KtorAuthenticatedHttpClient(
        httpClient = httpClientProvider(),
        apiUrl = apiUrl,
        credential = credential,
    )
}
