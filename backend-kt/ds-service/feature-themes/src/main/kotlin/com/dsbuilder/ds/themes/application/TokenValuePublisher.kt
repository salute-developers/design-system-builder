package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.application.palette.TenantValuePaletteSnapshot
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.palette.ShadowLayerColors
import com.dsbuilder.ds.themes.domain.palette.TenantPaletteValueResolver
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/**
 * Форма значений `token-values` для потребителей пакета: ссылки на палитру раскрыты по палитре темы [snapshot] на
 * границе выбранной версии, сплошные значения iOS и Android градиентного семейства — слоем `color`, цвета слоёв
 * тени — `#RRGGBBAA` на своём месте.
 */
internal class TokenValuePublisher(snapshot: TenantValuePaletteSnapshot?) {
    // Имя тени определяет группу палитры, по которой раскрываются ссылки её слоёв.
    private val resolver = snapshot?.let { TenantPaletteValueResolver(it.state, it.tokens) }
    private val resolvedReferences = mutableMapOf<Pair<String, PaletteReference>, String?>()
    private val tokenNames = snapshot?.tokens?.associate { it.id to it.name }.orEmpty()
    private val shadowNames = snapshot?.layerTokens?.associate { it.id to it.name }.orEmpty()
    private val paletteIdReferences = snapshot?.values
        ?.filter { it.valueId != null && it.reference != null }
        ?.associate { it.valueId to it.reference }
        .orEmpty()

    /** Значения в форме для чтения; значения не цветовых токенов не меняются. */
    fun publish(values: List<TenantTokenValue>): List<TenantTokenValue> = values.map(::publish)

    @Suppress("ReturnCount")
    private fun publish(value: TenantTokenValue): TenantTokenValue {
        if (value.tokenType == ThemeTokenType.SHADOW) return publishedShadow(value)
        val type = value.tokenType?.takeIf { it in ColorTokenFamily.TYPES } ?: return value
        val platform = ThemeTokenPlatform.fromWire(value.platform) ?: return value
        val stored = value.valueElement()
        val tokenName = value.tokenId?.toString()?.let(tokenNames::get)
        if (value.paletteId != null) {
            // Ссылка `palette_id` на всё значение: прежний контракт с `paletteRef` без `sourceValue`.
            val reference = paletteIdReferences[value.id.toString()] ?: return value
            val hex = resolve(tokenName, reference) ?: return value
            val published = ColorValueShape.publishedForm(platform, JsonArray(listOf(JsonPrimitive(hex))), type)
            return value.copy(
                paletteId = null,
                value = published,
                paletteRef = reference.format(),
            )
        }
        stored ?: return value
        val references = ValuePaletteReferences.find(stored)
        if (references.isEmpty()) {
            val published = ColorValueShape.publishedForm(platform, stored, type)
            return if (published == stored) value else value.copy(value = published, sourceValue = stored)
        }
        val hexes = references.distinct().associateWith { resolve(tokenName, it) }
        // Нераскрываемая ссылка (в том числе без снимка палитры) остаётся в значении без `paletteRef`, но форма
        // значения по типу семейства применяется всегда: потребители различают значения по типу токена.
        val resolvable = hexes.values.none { it == null }
        val whole = ColorValueShape.solidColor(ThemeTokenPlatform.WEB, stored)
            ?.let(PaletteReference::parse)?.takeIf { resolvable }
        val resolved = when {
            !resolvable -> stored
            whole != null -> JsonArray(listOf(JsonPrimitive(requireNotNull(hexes[whole]))))
            else -> ValuePaletteReferences.rewrite(stored) { hexes[it] }
        }
        val published: JsonElement = ColorValueShape.publishedForm(platform, resolved, type)
        if (published == stored) return value
        // Ссылка на всё значение отдаётся в `paletteRef`; `sourceValue` в этом случае не нужен и не отдаётся.
        return value.copy(
            value = published,
            paletteRef = whole?.format(),
            sourceValue = stored.takeIf { whole == null },
        )
    }

    /** Значение тени с цветами слоёв, раскрытыми по палитре темы; нераскрываемая ссылка остаётся как есть. */
    private fun publishedShadow(value: TenantTokenValue): TenantTokenValue {
        val stored = value.valueElement() ?: return value
        val tokenName = value.tokenId?.toString()?.let(shadowNames::get) ?: return value
        val resolved = ShadowLayerColors.mapReferences(stored) { reference ->
            resolve(tokenName, reference)?.let(SizePlatformValues::normalizedColor)
        }
        return if (resolved == stored) {
            value
        } else {
            value.copy(
                value = resolved,
                sourceValue = stored,
            )
        }
    }

    private fun resolve(tokenName: String?, reference: PaletteReference): String? {
        val colors = resolver ?: return null
        val name = tokenName ?: return null
        val key = name to reference
        if (key !in resolvedReferences) resolvedReferences[key] = colors.resolve(name, reference)
        return resolvedReferences[key]
    }
}
