package com.dsbuilder.settings.data

import com.dsbuilder.settings.application.AccountIdentityReader
import com.dsbuilder.settings.application.IdentityUnavailable
import com.dsbuilder.settings.domain.AccountIdentity
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.http.encodeURLPathPart
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

internal data class KeycloakIdentityConfiguration(
    val baseUrl: String,
    val realm: String,
    val clientId: String,
    val clientSecret: String,
)

internal class KeycloakAccountIdentityReader(
    private val configuration: KeycloakIdentityConfiguration,
    private val client: HttpClient,
) : AccountIdentityReader {
    private val mutex = Mutex()
    private var cachedToken: String? = null
    private var tokenExpiresAt = 0L

    override suspend fun read(userId: String): AccountIdentity? = try {
        val token = accessToken()
        val userUrl = "${configuration.baseUrl}/admin/realms/" +
            "${configuration.realm.encodeURLPathPart()}/users/${userId.encodeURLPathPart()}"
        val response = client.get(userUrl) { bearerAuth(token) }
        when (response.status) {
            HttpStatusCode.NotFound -> null
            HttpStatusCode.OK -> identity(response.body<AccountRepresentation>(), userId, userUrl, token)
            else -> {
                if (response.status == HttpStatusCode.Unauthorized) mutex.withLock { cachedToken = null }
                throw IdentityUnavailable()
            }
        }
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (_: Exception) {
        throw IdentityUnavailable()
    }

    private suspend fun identity(
        user: AccountRepresentation,
        userId: String,
        userUrl: String,
        token: String,
    ): AccountIdentity {
        if (user.id != userId) throw IdentityUnavailable()
        if (!user.enabled) return AccountIdentity(false, false)
        val roles = client.get("$userUrl/role-mappings/realm/composite") { bearerAuth(token) }
        if (roles.status != HttpStatusCode.OK) throw IdentityUnavailable()
        return AccountIdentity(
            true,
            roles.body<List<RoleRepresentation>>().any { it.name == "system_admin" },
            user.serviceAccountClientId != null,
        )
    }

    private suspend fun accessToken(): String = mutex.withLock {
        val now = System.currentTimeMillis()
        cachedToken?.takeIf { tokenExpiresAt > now }?.let { return@withLock it }
        val response = client.submitForm(
            "${configuration.baseUrl}/realms/${configuration.realm.encodeURLPathPart()}/protocol/openid-connect/token",
            Parameters.build {
                append("grant_type", "client_credentials")
                append("client_id", configuration.clientId)
                append("client_secret", configuration.clientSecret)
            },
        )
        if (response.status != HttpStatusCode.OK) throw IdentityUnavailable()
        val result = response.body<ServiceAccessToken>()
        tokenExpiresAt = now + (result.expiresIn - 10).coerceIn(0, 3600) * 1000
        result.accessToken.also { cachedToken = it }
    }
}

@Serializable
private data class AccountRepresentation(
    val id: String,
    val enabled: Boolean,
    val serviceAccountClientId: String? = null,
)

@Serializable
private data class RoleRepresentation(val name: String)

@Serializable
private data class ServiceAccessToken(
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Long,
)
