package com.dsbuilder.ds.themes.application

import com.dsbuilder.ds.themes.application.palette.TenantPaletteSnapshot
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteResolver
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID

/**
 * Форма значений `token-values` для потребителей пакета: ссылки на палитру раскрыты по палитре темы [snapshot] на
 * границе выбранной версии, сплошные значения iOS и Android градиентного семейства — слоем `color`.
 */
internal class TokenValuePublisher(tenantId: UUID, private val snapshot: TenantPaletteSnapshot?) {
    private val palette = snapshot?.let {
        ThemePaletteBuilder.build(tenantId.toString(), false, it.state, it.tokens, it.values)
    }
    private val tokenNames = snapshot?.tokens?.associate { it.id to it.name }.orEmpty()
    private val paletteIdReferences = snapshot?.values
        ?.filter { it.valueId != null && it.reference != null }
        ?.associate { it.valueId to it.reference }
        .orEmpty()

    /** Значения в форме для чтения; значения не цветовых токенов не меняются. */
    fun publish(values: List<TenantTokenValue>): List<TenantTokenValue> = values.map(::publish)

    @Suppress("ReturnCount")
    private fun publish(value: TenantTokenValue): TenantTokenValue {
        val type = value.tokenType?.takeIf { it in ColorTokenFamily.TYPES } ?: return value
        val platform = ThemeTokenPlatform.fromWire(value.platform) ?: return value
        val stored = value.valueJson?.let(Json::parseToJsonElement)
        val tokenName = value.tokenId?.toString()?.let(tokenNames::get)
        if (value.paletteId != null) {
            // Ссылка `palette_id` на всё значение: прежний контракт с `paletteRef` без `sourceValue`.
            val reference = paletteIdReferences[value.id.toString()] ?: return value
            val hex = resolve(tokenName, reference) ?: return value
            val published = ColorValueShape.publishedForm(platform, JsonArray(listOf(JsonPrimitive(hex))), type)
            return value.copy(paletteId = null, valueJson = published.toString(), paletteRef = reference.format())
        }
        stored ?: return value
        val references = ValuePaletteReferences.find(stored)
        val hexes = references.distinct().associateWith { resolve(tokenName, it) }
        // Нераскрываемая ссылка (в том числе без снимка палитры) остаётся в значении без `paletteRef`, но форма
        // значения по типу семейства применяется всегда: потребители различают значения по типу токена.
        val resolvable = hexes.values.none { it == null }
        val whole = ColorValueShape.solidColor(ThemeTokenPlatform.WEB, stored)
            ?.let(PaletteReference::parse)?.takeIf { resolvable }
        val resolved = when {
            !resolvable || references.isEmpty() -> stored
            whole != null -> JsonArray(listOf(JsonPrimitive(requireNotNull(hexes[whole]))))
            else -> ValuePaletteReferences.rewrite(stored) { hexes[it] }
        }
        val published: JsonElement = ColorValueShape.publishedForm(platform, resolved, type)
        if (published == stored) return value
        // Ссылка на всё значение отдаётся в `paletteRef`; `sourceValue` в этом случае не нужен и не отдаётся.
        return value.copy(
            valueJson = published.toString(),
            paletteRef = whole?.format(),
            sourceValueJson = stored.toString().takeIf { whole == null },
        )
    }

    private fun resolve(tokenName: String?, reference: PaletteReference): String? {
        val themePalette = palette ?: return null
        return tokenName?.let { ThemePaletteResolver.resolve(themePalette, it, reference) }
    }
}
