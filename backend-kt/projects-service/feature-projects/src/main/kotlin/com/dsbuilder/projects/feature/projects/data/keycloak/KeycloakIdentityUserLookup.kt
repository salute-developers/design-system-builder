package com.dsbuilder.projects.feature.projects.data.keycloak

import com.dsbuilder.projects.feature.projects.application.IdentityProviderUnavailableException
import com.dsbuilder.projects.feature.projects.application.port.IdentityUser
import com.dsbuilder.projects.feature.projects.application.port.IdentityUserLookup
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

internal class KeycloakIdentityUserLookup(
    private val configuration: KeycloakIdentityLookupConfiguration,
    private val client: HttpClient = defaultHttpClient(configuration),
) : IdentityUserLookup {
    private val tokenMutex = Mutex()

    @Volatile
    private var cachedAccessToken: CachedAccessToken? = null

    override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? =
        withAccessToken { accessToken ->
            val usersResponse = client.get("${configuration.baseUrl}/admin/realms/${configuration.realm}/users") {
                bearerAuth(accessToken)
                parameter("email", email)
                parameter("exact", true)
            }
            if (usersResponse.status != HttpStatusCode.OK) {
                throw IdentityProviderUnavailableException()
            }

            usersResponse.body<List<KeycloakUserRepresentation>>()
                .firstOrNull { it.email.equals(email, ignoreCase = true) }
                ?.toIdentityUser()
        }

    override suspend fun findRegisteredUserByIdentifier(identifier: String): IdentityUser? =
        searchRegisteredUsers(identifier, 20).firstOrNull { user ->
            user.email.equals(identifier, ignoreCase = true) ||
                user.username.equals(identifier, ignoreCase = true)
        }

    override suspend fun findRegisteredUserById(userId: String): IdentityUser? =
        withAccessToken { accessToken ->
            val response = client.get(
                "${configuration.baseUrl}/admin/realms/${configuration.realm}/users/$userId",
            ) {
                bearerAuth(accessToken)
            }
            when (response.status) {
                HttpStatusCode.OK -> response.body<KeycloakUserRepresentation>().toIdentityUser()
                HttpStatusCode.NotFound -> null
                else -> throw IdentityProviderUnavailableException()
            }
        }

    override suspend fun searchRegisteredUsers(query: String, limit: Int): List<IdentityUser> =
        withAccessToken { accessToken ->
            val usersResponse = client.get("${configuration.baseUrl}/admin/realms/${configuration.realm}/users") {
                bearerAuth(accessToken)
                parameter("search", query)
                parameter("max", limit.coerceIn(1, 20))
            }
            if (usersResponse.status != HttpStatusCode.OK) {
                throw IdentityProviderUnavailableException()
            }
            usersResponse.body<List<KeycloakUserRepresentation>>()
                .asSequence()
                .filter { it.enabled != false }
                .map { it.toIdentityUser() }
                .take(limit.coerceIn(1, 20))
                .toList()
        }

    private suspend fun <T> withAccessToken(block: suspend (String) -> T): T =
        runCatching {
            block(getAccessToken())
        }.getOrElse {
            throw IdentityProviderUnavailableException()
        }

    private suspend fun getAccessToken(): String {
        val now = System.currentTimeMillis()
        cachedAccessToken?.takeIf { it.expiresAtMillis > now }?.let { return it.value }
        tokenMutex.lock()
        try {
            val lockedNow = System.currentTimeMillis()
            cachedAccessToken?.takeIf { it.expiresAtMillis > lockedNow }?.let { return it.value }
            val tokenResponse = client.submitForm(
                url = "${configuration.baseUrl}/realms/${configuration.realm}/protocol/openid-connect/token",
                formParameters = Parameters.build {
                    append("grant_type", "client_credentials")
                    append("client_id", configuration.clientId)
                    append("client_secret", configuration.clientSecret)
                },
            )
            if (tokenResponse.status != HttpStatusCode.OK) {
                throw IdentityProviderUnavailableException()
            }
            val token = tokenResponse.body<KeycloakAccessTokenResponse>()
            val reusableForSeconds = (token.expiresInSeconds - 10).coerceAtLeast(1)
            cachedAccessToken = CachedAccessToken(
                value = token.accessToken,
                expiresAtMillis = lockedNow + reusableForSeconds * 1_000,
            )
            return token.accessToken
        } finally {
            tokenMutex.unlock()
        }
    }
}

private data class CachedAccessToken(
    val value: String,
    val expiresAtMillis: Long,
)

@Serializable
private data class KeycloakAccessTokenResponse(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("expires_in")
    val expiresInSeconds: Long = 60,
)

@Serializable
private data class KeycloakUserRepresentation(
    val id: String,
    val email: String? = null,
    @SerialName("firstName")
    val firstName: String? = null,
    @SerialName("lastName")
    val lastName: String? = null,
    @SerialName("username")
    val username: String? = null,
    val enabled: Boolean? = null,
) {
    fun toIdentityUser(): IdentityUser =
        IdentityUser(
            userId = id,
            email = email.orEmpty(),
            displayName = listOfNotNull(firstName, lastName)
                .joinToString(" ")
                .ifBlank { username },
            username = username,
        )
}

private fun defaultHttpClient(configuration: KeycloakIdentityLookupConfiguration): HttpClient =
    HttpClient(CIO) {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                },
            )
        }
        install(HttpTimeout) {
            requestTimeoutMillis = configuration.timeout.inWholeMilliseconds
            connectTimeoutMillis = configuration.timeout.inWholeMilliseconds
            socketTimeoutMillis = configuration.timeout.inWholeMilliseconds
        }
    }
