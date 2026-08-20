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
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

internal class KeycloakIdentityUserLookup(
    private val configuration: KeycloakIdentityLookupConfiguration,
    private val client: HttpClient = defaultHttpClient(configuration),
) : IdentityUserLookup {
    override suspend fun findRegisteredUserByEmail(email: String): IdentityUser? =
        runCatching {
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
            val accessToken = tokenResponse.body<KeycloakAccessTokenResponse>().accessToken

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
        }.getOrElse {
            throw IdentityProviderUnavailableException()
        }
}

@Serializable
private data class KeycloakAccessTokenResponse(
    @SerialName("access_token")
    val accessToken: String,
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
) {
    fun toIdentityUser(): IdentityUser =
        IdentityUser(
            userId = id,
            email = email.orEmpty(),
            displayName = listOfNotNull(firstName, lastName)
                .joinToString(" ")
                .ifBlank { username },
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
