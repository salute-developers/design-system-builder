package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.submitForm
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Parameters
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

private const val GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code"
private const val GRANT_TYPE_REFRESH_TOKEN = "refresh_token"
private const val HTTP_SERVER_ERROR = 500

/**
 * Ответ `/auth/token` содержит больше полей, чем нужно клиенту (`token_type`, `id_token`,
 * `refresh_expires_in`, `scope`, `session_state`, `not-before-policy`, …) — без
 * `ignoreUnknownKeys` разбор падает на первом же реальном ответе Keycloak.
 */
private val json = Json { ignoreUnknownKeys = true }

@Serializable
private data class TokenResponseDto(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long,
)

/**
 * Ktor-реализация [TokenExchangeClient] поверх `/auth/token` identity-gateway. Живёт в
 * `core-network`, а не в `core-auth`, чтобы `core-auth` не зависел от HTTP client — тот же
 * принцип, что и у [KtorAuthenticatedHttpClient].
 */
public class KtorTokenExchangeClient(
    private val httpClient: HttpClient,
    private val tokenEndpointUrl: String,
) : TokenExchangeClient {
    override suspend fun exchangeAuthorizationCode(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        clientId: String,
    ): TokenExchangeResult = request(
        Parameters.build {
            append("grant_type", GRANT_TYPE_AUTHORIZATION_CODE)
            append("code", code)
            append("code_verifier", codeVerifier)
            append("redirect_uri", redirectUri)
            append("client_id", clientId)
        },
    )

    override suspend fun refresh(
        refreshToken: String,
        clientId: String,
    ): TokenExchangeResult = request(
        Parameters.build {
            append("grant_type", GRANT_TYPE_REFRESH_TOKEN)
            append("refresh_token", refreshToken)
            append("client_id", clientId)
        },
        currentRefreshToken = refreshToken,
    )

    private suspend fun request(formParameters: Parameters, currentRefreshToken: String? = null) =
        requestTokens(httpClient, tokenEndpointUrl, formParameters, currentRefreshToken)
}

/**
 * Запрашивает токены на token endpoint. Сервер может не вернуть новый refresh token при обновлении:
 * тогда остаётся [currentRefreshToken].
 *
 * `kotlinx.serialization` бросает разные типы исключений в зависимости от природы
 * невалидного JSON; общего для commonMain супертипа, кроме `Exception`, нет.
 */
@Suppress("TooGenericExceptionCaught")
internal suspend fun requestTokens(
    httpClient: HttpClient,
    url: String,
    formParameters: Parameters,
    currentRefreshToken: String? = null,
): TokenExchangeResult {
    val response = httpClient.submitForm(url = url, formParameters = formParameters)
    if (!response.status.isSuccess()) throw response.exchangeFailure()

    val dto = try {
        json.decodeFromString(TokenResponseDto.serializer(), response.bodyAsText())
    } catch (exception: Exception) {
        null
    }
    val refreshToken = dto?.refreshToken?.takeIf { it.isNotEmpty() } ?: currentRefreshToken
    if (dto == null || dto.accessToken.isEmpty() || refreshToken == null) {
        throw TokenExchangeException("Token exchange response could not be parsed.")
    }

    return TokenExchangeResult(
        accessToken = dto.accessToken,
        refreshToken = refreshToken,
        expiresInSeconds = dto.expiresIn,
    )
}

/** Отказ с кодом OAuth из тела ответа; у `5xx` кода нет: запрос можно повторить. */
internal suspend fun HttpResponse.exchangeFailure(): TokenExchangeException {
    val message = "Token exchange failed with HTTP ${status.value}."
    if (status.value >= HTTP_SERVER_ERROR) return TokenExchangeException(message)
    val code = runCatching {
        (json.parseToJsonElement(bodyAsText()).jsonObject["error"] as? JsonPrimitive)?.content
    }.getOrNull()
    return TokenExchangeException(message, code ?: "http_${status.value}")
}
