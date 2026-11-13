package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.AuthErrorCode
import com.dsbuilder.frontend.core.auth.AuthResult
import io.ktor.client.HttpClient
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Читает подтверждённое безопасное имя пользователя отдельно от обмена токенов. */
internal class KtorUserInfoClient(private val httpClient: HttpClient, private val json: Json) {
    @Suppress("TooGenericExceptionCaught")
    suspend fun read(apiUrl: String, accessToken: String): AuthResult<String> {
        if (!allowsInteractiveAuth(apiUrl)) return invalidAuthUrl()
        return try {
            val response = httpClient.get(oauthEndpoint(apiUrl, "/realms/dsbuilder/protocol/openid-connect/userinfo")) {
                bearerAuth(accessToken)
            }
            if (!response.status.isSuccess()) {
                AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Не удалось подтвердить пользователя.")
            } else {
                val info: GatewayUserInfo = json.decodeFromString(response.bodyAsText())
                val name = info.username
                val validName = name.isNotBlank() && name.length <= 256 && name.none { it.isISOControl() }
                if (info.subject.isBlank() || !validName) {
                    AuthResult.Failed(AuthErrorCode.AUTH_REQUIRED, "Некорректный ответ userinfo.")
                } else {
                    AuthResult.Success(name)
                }
            }
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            AuthResult.Failed(AuthErrorCode.BACKEND_UNAVAILABLE, "Userinfo недоступен.")
        }
    }
}

@Serializable
private data class GatewayUserInfo(
    @SerialName("sub") val subject: String,
    @SerialName("preferred_username") val username: String,
)
