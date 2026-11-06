package com.dsbuilder.frontend.core.network

import com.dsbuilder.frontend.core.auth.DeviceAuthorization
import com.dsbuilder.frontend.core.auth.DeviceAuthorizationClient
import com.dsbuilder.frontend.core.auth.TokenExchangeException
import io.ktor.client.HttpClient
import io.ktor.client.request.forms.submitForm
import io.ktor.client.statement.bodyAsText
import io.ktor.http.Parameters
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"

/** Значения RFC 8628, если сервер их не вернул. */
private const val DEFAULT_INTERVAL_SECONDS = 5L
private const val DEFAULT_EXPIRES_IN_SECONDS = 600L

private val json = Json { ignoreUnknownKeys = true }

@Serializable
private data class DeviceResponseDto(
    @SerialName("device_code") val deviceCode: String,
    @SerialName("user_code") val userCode: String,
    @SerialName("verification_uri") val verificationUri: String? = null,
    @SerialName("verification_uri_complete") val verificationUriComplete: String? = null,
    val interval: Long? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
)

/** Ktor-реализация [DeviceAuthorizationClient] поверх публичного gateway. */
public class KtorDeviceAuthorizationClient(
    private val httpClient: HttpClient,
    private val gatewayUrl: String,
    private val realm: String,
) : DeviceAuthorizationClient {
    /** Разбор падает разными исключениями, см. [requestTokens]. */
    @Suppress("TooGenericExceptionCaught")
    override suspend fun requestDeviceCode(clientId: String, scope: String): DeviceAuthorization {
        val response = httpClient.submitForm(
            url = "$gatewayUrl/realms/$realm/protocol/openid-connect/auth/device",
            formParameters = Parameters.build {
                append("client_id", clientId)
                append("scope", scope)
            },
        )
        if (!response.status.isSuccess()) throw response.exchangeFailure()
        val dto = try {
            json.decodeFromString(DeviceResponseDto.serializer(), response.bodyAsText())
        } catch (exception: Exception) {
            throw TokenExchangeException("Device authorization response could not be parsed.")
        }
        return DeviceAuthorization(
            deviceCode = dto.deviceCode,
            userCode = dto.userCode,
            verificationUri = dto.verificationUriComplete ?: dto.verificationUri
                ?: throw TokenExchangeException("Device authorization response could not be parsed."),
            intervalSeconds = dto.interval?.takeIf { it > 0 } ?: DEFAULT_INTERVAL_SECONDS,
            expiresInSeconds = dto.expiresIn?.takeIf { it > 0 } ?: DEFAULT_EXPIRES_IN_SECONDS,
        )
    }

    override suspend fun exchangeDeviceCode(clientId: String, deviceCode: String) = requestTokens(
        httpClient,
        "$gatewayUrl/auth/token",
        Parameters.build {
            append("client_id", clientId)
            append("grant_type", DEVICE_GRANT)
            append("device_code", deviceCode)
        },
    )

    override suspend fun logout(clientId: String, refreshToken: String) {
        val response = httpClient.submitForm(
            url = "$gatewayUrl/auth/logout",
            formParameters = Parameters.build {
                append("client_id", clientId)
                append("refresh_token", refreshToken)
            },
        )
        if (!response.status.isSuccess()) throw response.exchangeFailure()
    }
}
