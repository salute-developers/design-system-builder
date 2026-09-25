package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenant
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsClient
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsErrorCode
import com.dsbuilder.frontend.feature.theme.application.DesignSystemTenantsResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

private const val HTTP_UNAUTHORIZED = 401

/** Ktor-реализация [DesignSystemTenantsClient]. */
public class HttpDesignSystemTenantsClient(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : DesignSystemTenantsClient {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun listTenants(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
    ): DesignSystemTenantsResult {
        val client = httpClientFactory.create(apiUrl, credential)
        return when (val result = client.get("/api/projects/$projectId/ds/design-systems/$designSystemId/tenants")) {
            is AuthenticatedHttpResult.Success -> decode(result.body)
            is AuthenticatedHttpResult.Failure -> DesignSystemTenantsResult.Failed(
                if (result.statusCode == HTTP_UNAUTHORIZED) {
                    DesignSystemTenantsErrorCode.AUTH_REQUIRED
                } else {
                    DesignSystemTenantsErrorCode.BACKEND_UNAVAILABLE
                },
                result.message,
            )
        }
    }

    private fun decode(body: String): DesignSystemTenantsResult =
        try {
            DesignSystemTenantsResult.Success(
                json.decodeFromString<List<TenantDto>>(body).map {
                    DesignSystemTenant(id = it.id, name = it.name ?: it.id, description = it.description)
                },
            )
        } catch (exception: SerializationException) {
            DesignSystemTenantsResult.Failed(
                DesignSystemTenantsErrorCode.BACKEND_UNAVAILABLE,
                "Error: failed to parse tenant list.",
            )
        }
}

@Serializable
private data class TenantDto(
    val id: String,
    val name: String? = null,
    val description: String? = null,
)
