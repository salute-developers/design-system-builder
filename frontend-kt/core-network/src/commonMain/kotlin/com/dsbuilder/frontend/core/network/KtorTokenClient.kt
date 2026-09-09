package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import com.dsbuilder.frontend.core.auth.TokenClient
import com.dsbuilder.frontend.core.auth.TokenResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.forms.submitForm
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.Url
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

private const val PUBLIC_CLIENT_ID = "dsbuilder-api"

/**
 * Gateway-backed token client for user sessions.
 */
public class KtorTokenClient(
    private val httpClient: HttpClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : TokenClient {
    override suspend fun login(
        apiUrl: String,
        username: String,
        password: String,
    ): AuthResult<TokenResponse> {
        if (!allowsPasswordAuth(apiUrl)) {
            return AuthResult.Failed(
                AuthErrorCode.INVALID_AUTH_URL,
                "Error: password auth requires HTTPS, except localhost and 127.0.0.1.",
            )
        }
        return requestToken(
            apiUrl = apiUrl,
            parameters = Parameters.build {
                append("grant_type", "password")
                append("client_id", PUBLIC_CLIENT_ID)
                append("username", username)
                append("password", password)
                append("scope", "openid")
            },
        )
    }

    override suspend fun refresh(apiUrl: String, refreshToken: String): AuthResult<TokenResponse> =
        requestToken(
            apiUrl = apiUrl,
            parameters = Parameters.build {
                append("grant_type", "refresh_token")
                append("client_id", PUBLIC_CLIENT_ID)
                append("refresh_token", refreshToken)
            },
        )

    @Suppress("TooGenericExceptionCaught")
    override suspend fun logout(apiUrl: String, refreshToken: String): AuthResult<Unit> =
        try {
            val response = httpClient.submitForm(
                url = endpoint(apiUrl, "/auth/logout"),
                formParameters = Parameters.build {
                    append("client_id", PUBLIC_CLIENT_ID)
                    append("refresh_token", refreshToken)
                },
            )
            when {
                response.status.isSuccess() -> AuthResult.Success(Unit)
                response.status == HttpStatusCode.Unauthorized -> AuthResult.Failed(
                    AuthErrorCode.AUTH_REQUIRED,
                    "Error: user session is not authorized.",
                )
                else -> AuthResult.Failed(
                    AuthErrorCode.BACKEND_UNAVAILABLE,
                    "Error: backend returned HTTP ${response.status.value}.",
                )
            }
        } catch (exception: Exception) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, transportMessage(exception))
        }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun requestToken(
        apiUrl: String,
        parameters: Parameters,
    ): AuthResult<TokenResponse> =
        try {
            val response = httpClient.submitForm(endpoint(apiUrl, "/auth/token"), parameters)
            when {
                response.status.isSuccess() -> decodeToken(response.bodyAsText())
                response.status == HttpStatusCode.BadRequest -> decodeTokenError(response.bodyAsText())
                response.status == HttpStatusCode.Unauthorized -> AuthResult.Failed(
                    AuthErrorCode.AUTH_REQUIRED,
                    "Error: credentials are invalid or expired.",
                )
                response.status == HttpStatusCode.Forbidden -> AuthResult.Failed(
                    AuthErrorCode.FORBIDDEN,
                    "Error: authentication is forbidden.",
                )
                else -> AuthResult.Failed(
                    AuthErrorCode.BACKEND_UNAVAILABLE,
                    "Error: backend returned HTTP ${response.status.value}.",
                )
            }
        } catch (exception: Exception) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, transportMessage(exception))
        }

    private fun decodeToken(body: String): AuthResult<TokenResponse> =
        try {
            val response: GatewayTokenResponse = json.decodeFromString(body)
            AuthResult.Success(
                TokenResponse(
                    accessToken = response.accessToken,
                    refreshToken = response.refreshToken,
                    refreshExpiresAt = response.refreshExpiresIn ?: response.expiresIn,
                ),
            )
        } catch (exception: SerializationException) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: cannot parse token response.")
        } catch (exception: IllegalArgumentException) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: cannot parse token response.")
        }

    private fun decodeTokenError(body: String): AuthResult<TokenResponse> =
        try {
            val response: GatewayErrorResponse = json.decodeFromString(body)
            if (response.error == "invalid_grant") {
                AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Error: credentials are invalid or expired.")
            } else {
                AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: token request failed.")
            }
        } catch (exception: SerializationException) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: token request failed.")
        } catch (exception: IllegalArgumentException) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Error: token request failed.")
        }

    private fun endpoint(apiUrl: String, path: String): String = "${apiUrl.trimEnd('/')}/${path.trimStart('/')}"

    private fun allowsPasswordAuth(apiUrl: String): Boolean {
        val url = Url(apiUrl)
        return url.protocol.name == "https" || url.host == "localhost" || url.host == "127.0.0.1"
    }

    private fun transportMessage(exception: Exception): String =
        "Error: backend is unavailable${exception.message?.substringBefore('\n')?.let { ": $it" } ?: "."}"
}

@Serializable
private data class GatewayTokenResponse(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("refresh_token")
    val refreshToken: String,
    @SerialName("expires_in")
    val expiresIn: Long,
    @SerialName("refresh_expires_in")
    val refreshExpiresIn: Long? = null,
)

@Serializable
private data class GatewayErrorResponse(
    val error: String,
)
