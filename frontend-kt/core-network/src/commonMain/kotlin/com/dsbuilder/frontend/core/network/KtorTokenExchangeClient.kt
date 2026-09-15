package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.TokenExchangeClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import com.dsbuilder.frontend.core.auth.TokenExchangeResult
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.submitForm
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Parameters
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val GRANT_TYPE_AUTHORIZATION_CODE = "authorization_code"
private const val GRANT_TYPE_REFRESH_TOKEN = "refresh_token"

/**
 * Ответ `/auth/token` содержит больше полей, чем нужно клиенту (`token_type`, `id_token`,
 * `refresh_expires_in`, `scope`, `session_state`, `not-before-policy`, …) — без
 * `ignoreUnknownKeys` разбор падает на первом же реальном ответе Keycloak.
 */
private val json = Json { ignoreUnknownKeys = true }

@Serializable
private data class TokenResponseDto(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
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
    )

    /**
     * `kotlinx.serialization` бросает разные типы исключений в зависимости от природы
     * невалидного JSON; общего для commonMain супертипа, кроме `Exception`, нет.
     */
    @Suppress("TooGenericExceptionCaught")
    private suspend fun request(formParameters: Parameters): TokenExchangeResult {
        val response = httpClient.submitForm(url = tokenEndpointUrl, formParameters = formParameters)
        if (!response.status.isSuccess()) {
            throw TokenExchangeException("Token exchange failed with HTTP ${response.status.value}.")
        }

        val dto = try {
            json.decodeFromString(TokenResponseDto.serializer(), response.bodyAsText())
        } catch (exception: Exception) {
            throw TokenExchangeException("Token exchange response could not be parsed.")
        }

        return TokenExchangeResult(
            accessToken = dto.accessToken,
            refreshToken = dto.refreshToken,
            expiresInSeconds = dto.expiresIn,
        )
    }
}
