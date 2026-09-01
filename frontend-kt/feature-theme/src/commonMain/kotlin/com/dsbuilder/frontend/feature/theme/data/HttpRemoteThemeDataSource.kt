package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.theme.application.RemoteTenantThemeCommand
import com.dsbuilder.frontend.feature.theme.application.RemoteThemeCommand
import com.dsbuilder.frontend.feature.theme.application.RemoteThemeDataSource
import com.dsbuilder.frontend.feature.theme.application.RemoteThemeResult
import com.dsbuilder.frontend.feature.theme.domain.PaletteItem
import com.dsbuilder.frontend.feature.theme.domain.Platform
import com.dsbuilder.frontend.feature.theme.domain.Tenant
import com.dsbuilder.frontend.feature.theme.domain.Token
import com.dsbuilder.frontend.feature.theme.domain.TokenValue
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/**
 * HTTP adapter для загрузки theme data через project-scoped backend API.
 */
internal class HttpRemoteThemeDataSource(
    private val httpClientFactory: AuthenticatedHttpClientFactory,
) : RemoteThemeDataSource {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    override fun fetchTenants(command: RemoteThemeCommand): RemoteThemeResult<List<Tenant>> {
        val client = httpClientFactory.create(command.apiUrl.value, command.apiKey.value)
        return getDecoded(
            result = client.get(
                "/api/projects/${command.context.projectId.value}/ds/design-systems/" +
                    "${command.context.designSystemId.value}/tenants",
            ),
            decode = ::decodeTenants,
            parseFailureMessage = "Error: Cannot parse tenants response.",
        )
    }

    override fun fetchTokens(command: RemoteThemeCommand): RemoteThemeResult<List<Token>> {
        val client = httpClientFactory.create(command.apiUrl.value, command.apiKey.value)
        return getDecoded(
            result = client.get(
                "/api/projects/${command.context.projectId.value}/ds/design-systems/" +
                    "${command.context.designSystemId.value}/tokens",
            ),
            decode = ::decodeTokens,
            parseFailureMessage = "Error: Cannot parse tokens response.",
        )
    }

    override fun fetchPalette(command: RemoteThemeCommand): RemoteThemeResult<List<PaletteItem>> {
        val client = httpClientFactory.create(command.apiUrl.value, command.apiKey.value)
        return getDecoded(
            result = client.get(
                "/api/projects/${command.context.projectId.value}/ds/palette",
            ),
            decode = ::decodePalette,
            parseFailureMessage = "Error: Cannot parse palette response.",
        )
    }

    override fun fetchTokenValues(command: RemoteTenantThemeCommand): RemoteThemeResult<List<TokenValue>> {
        val client = httpClientFactory.create(command.apiUrl.value, command.apiKey.value)
        return getDecoded(
            result = client.get(
                "/api/projects/${command.context.projectId.value}/ds/tenants/${command.tenantId}/token-values",
            ),
            decode = ::decodeTokenValues,
            parseFailureMessage = "Error: Cannot parse token values response for tenant `${command.tenantId}`.",
        )
    }

    private fun <T> getDecoded(
        result: AuthenticatedHttpResult,
        decode: (String) -> T?,
        parseFailureMessage: String,
    ): RemoteThemeResult<T> =
        when (result) {
            is AuthenticatedHttpResult.Success -> decode(result.body)?.let(RemoteThemeResult<T>::Success)
                ?: RemoteThemeResult.Failed(parseFailureMessage)
            is AuthenticatedHttpResult.Failure -> RemoteThemeResult.Failed(result.message)
        }

    private fun decodeTenants(body: String): List<Tenant>? =
        decodeList(body, TenantResponse.serializer())?.map { it.toDomain() }

    private fun decodeTokens(body: String): List<Token>? =
        decodeList(body, TokenResponse.serializer())?.map { it.toDomain() }

    private fun decodePalette(body: String): List<PaletteItem>? =
        decodeList(body, PaletteItemResponse.serializer())?.map { it.toDomain() }

    private fun decodeTokenValues(body: String): List<TokenValue>? =
        try {
            if (body.isBlank()) {
                emptyList()
            } else {
                decodeList(body, TokenValueResponse.serializer())?.map { it.toDomain() }
            }
        } catch (exception: IllegalArgumentException) {
            null
        }

    private fun <T> decodeList(
        body: String,
        serializer: KSerializer<T>,
    ): List<T>? =
        try {
            json.decodeFromString(ListSerializer(serializer), body)
        } catch (exception: SerializationException) {
            null
        } catch (exception: IllegalArgumentException) {
            null
        }
}

@Serializable
private data class TenantResponse(
    val id: String,
    val designSystemId: String,
    val name: String,
    val description: String?,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toDomain(): Tenant = Tenant(
        id = id,
        designSystemId = designSystemId,
        name = name,
        description = description,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}

@Serializable
private data class TokenResponse(
    val id: String,
    val designSystemId: String,
    val name: String,
    val type: String,
    val displayName: String,
    val description: String,
    val enabled: Boolean,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toDomain(): Token = Token(
        id = id,
        designSystemId = designSystemId,
        name = name,
        type = type,
        displayName = displayName,
        description = description,
        enabled = enabled,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}

@Serializable
private data class PaletteItemResponse(
    val id: String,
    val type: String,
    val shade: String,
    val saturation: Int,
    val value: String,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toDomain(): PaletteItem = PaletteItem(
        id = id,
        type = type,
        shade = shade,
        saturation = saturation,
        value = value,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
}

@Serializable
private data class TokenValueResponse(
    val id: String,
    val tokenId: String,
    val tenantId: String,
    val paletteId: String?,
    val platform: String,
    val mode: String?,
    val value: List<JsonElement>?,
    val createdAt: String,
    val updatedAt: String,
) {
    fun toDomain(): TokenValue {
        val domainPlatform = Platform.from(platform)
            ?: throw IllegalArgumentException("Unsupported platform `$platform`.")
        return TokenValue(
            id = id,
            tokenId = tokenId,
            tenantId = tenantId,
            paletteId = paletteId,
            platform = domainPlatform,
            mode = mode,
            value = value,
            createdAt = createdAt,
            updatedAt = updatedAt,
        )
    }
}
