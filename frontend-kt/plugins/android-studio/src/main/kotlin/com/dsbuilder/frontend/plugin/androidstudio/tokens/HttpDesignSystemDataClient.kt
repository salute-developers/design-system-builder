package com.dsbuilder.frontend.plugin.androidstudio.tokens

import com.dsbuilder.frontend.plugin.androidstudio.api.ApiJson
import com.dsbuilder.frontend.plugin.androidstudio.api.ApiRequestException
import com.dsbuilder.frontend.plugin.androidstudio.api.AuthenticatedApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.roundToInt

private const val MAX_ALPHA = 255
private const val RGB_HEX_LENGTH = 7
private const val HEX_RADIX = 16

@Serializable
internal data class DesignSystemDto(
    val id: String,
    val name: String,
    val description: String? = null,
)

@Serializable
internal data class TokenDto(
    val id: String,
    val designSystemId: String? = null,
    val name: String,
    val type: String? = null,
    val displayName: String? = null,
)

@Serializable
internal data class TokenValueDto(
    val id: String,
    val tokenId: String? = null,
    val tenantId: String? = null,
    val paletteId: String? = null,
    val platform: String? = null,
    val mode: String? = null,
    val value: JsonElement? = null,
)

@Serializable
internal data class PaletteDto(
    val id: String,
    val value: String,
)

/**
 * Ktor-реализация [DesignSystemDataClient] поверх `/api/projects/{id}/ds/design-systems`,
 * `/ds/tokens` и `/ds/token-values`.
 */
public class HttpDesignSystemDataClient(
    private val apiClient: AuthenticatedApiClient,
) : DesignSystemDataClient {
    override suspend fun listDesignSystems(projectId: String): List<DesignSystem> {
        val dtos = getList<DesignSystemDto>("/api/projects/$projectId/ds/design-systems")
        return dtos.map { DesignSystem(id = it.id, name = it.name, description = it.description) }
    }

    override suspend fun listTokens(projectId: String): List<DesignToken> {
        val dtos = getList<TokenDto>("/api/projects/$projectId/ds/tokens")
        return dtos.map {
            DesignToken(
                id = it.id,
                designSystemId = it.designSystemId,
                name = it.name,
                type = TokenType.fromWireValue(it.type),
                displayName = it.displayName,
            )
        }
    }

    override suspend fun listTokenValues(projectId: String): List<TokenValue> {
        val dtos = getList<TokenValueDto>("/api/projects/$projectId/ds/token-values")
        // Цвет может быть ссылкой на палитру (`[general.green.600]`): тогда value пустое (или содержит
        // только непрозрачность), а сам цвет лежит в палитре — без её разрешения такие токены
        // (большинство цветов темы) показывались бы без значения.
        val palette = if (dtos.any { it.paletteId != null }) loadPalette(projectId) else emptyMap()
        return dtos.map {
            val paletteColor = it.paletteId?.let(palette::get)?.let { hex -> applyOpacity(hex, it.value) }
            TokenValue(
                id = it.id,
                tokenId = it.tokenId,
                tenantId = it.tenantId,
                platform = TokenPlatform.fromWireValue(it.platform),
                mode = TokenMode.fromWireValue(it.mode),
                rawValue = paletteColor ?: extractDisplayValue(it.value),
                wireValue = paletteColor?.let { hex -> JsonArray(listOf(JsonPrimitive(hex))) } ?: it.value,
            )
        }
    }

    private suspend fun loadPalette(projectId: String): Map<String, String> =
        getList<PaletteDto>("/api/projects/$projectId/ds/palette").associate { it.id to it.value }

    @Suppress("TooGenericExceptionCaught")
    private suspend inline fun <reified T> getList(path: String): List<T> {
        val body = apiClient.get(path)
        return try {
            ApiJson.decodeFromString<List<T>>(body)
        } catch (exception: Exception) {
            throw ApiRequestException("Не удалось разобрать ответ backend'а.")
        }
    }

    /**
     * Непрозрачность ссылки на палитру хранится в `value` как `["0.56"]`; итоговый цвет — в формате
     * `#RRGGBBAA`, как и остальные 8-значные цвета темы.
     */
    private fun applyOpacity(hex: String, value: JsonElement?): String {
        val opacity = ((value as? JsonArray)?.singleOrNull() as? JsonPrimitive)?.content?.toDoubleOrNull()
            ?: return hex
        val alpha = (opacity * MAX_ALPHA).roundToInt().coerceIn(0, MAX_ALPHA)
        return hex.take(RGB_HEX_LENGTH) + alpha.toString(HEX_RADIX).uppercase().padStart(2, '0')
    }

    /**
     * `value` в БД — `jsonb`, реально пришедшие значения оборачивают одиночный примитив в
     * массив (`["#F5F5F5F5"]`), а не хранят его как есть — единой схемы под каждый тип токена
     * нет. Разворачиваем этот частый случай, чтобы `parseHexColor` мог узнать цвет; для прочих
     * форм (объекты, массивы из нескольких элементов — например градиенты) остаётся raw JSON.
     */
    private fun extractDisplayValue(element: JsonElement?): String {
        if (element == null) return ""
        if (element is JsonArray && element.size == 1) {
            val single = element.single()
            if (single is JsonPrimitive) return single.content
        }
        return element.toString()
    }
}
