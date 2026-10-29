package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.themes.domain.palette.PaletteReference
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenViews
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueParser
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueViolation
import java.util.UUID

internal const val INVALID_SIZE_TOKEN = "INVALID_SIZE_TOKEN"
internal const val INVALID_SIZE_VALUE = "INVALID_SIZE_VALUE"

/** Отказ с кодом [INVALID_SIZE_TOKEN]: токен другого типа, имя вне правила или правка полного скругления. */
internal fun invalidSizeToken(message: String) = DsFailure.InvalidRequest(INVALID_SIZE_TOKEN, message = message)

/** Отказ с кодом [INVALID_SIZE_VALUE], полем запроса в `details.field` и текстом проверки в `message`. */
internal fun SizeValueViolation.toFailure() =
    DsFailure.InvalidRequest(INVALID_SIZE_VALUE, details = mapOf("field" to field), message = message)

/** Отказ для ссылки цвета слоя [field] на ступень, которой нет в палитре темы. */
internal fun missingPaletteStep(field: String) = SizeValueViolation(field, SizeValueParser.MISSING_STEP).toFailure()

/** Отказ для токена, который не относится к разделу. */
internal fun outsideSection(tokenId: UUID) =
    invalidSizeToken("Токен $tokenId не является радиусом, отступом или тенью по правилам имён раздела")

/** Раскрытие ссылки цвета слоя тени: имя токена и ссылка → `#RRGGBBAA` или `null`. */
internal typealias ShadowColorResolver = (String, PaletteReference) -> String?

/**
 * Токены [tokens] в формате чтения: только радиусы, отступы и тени по правилам имён, с использованием компонентами
 * дизайн-системы [designSystemId], вычисляемыми радиусами и раскрытыми по палитре темы цветами слоёв тени.
 */
internal suspend fun SizeTokenUsageRepository.views(
    designSystemId: UUID,
    tokens: List<StoredSizeToken>,
    resolveColor: ShadowColorResolver,
): List<SizeTokenView> {
    val sized = tokens.filter { it.kind != null }
    if (sized.isEmpty()) return emptyList()
    val usage = usage(designSystemId, sized.associate { it.id to it.name })
    val radii = sized.filter { it.kind == SizeTokenKind.RADIUS }.associate { it.id to it.name }
    val offsets = if (radii.isEmpty()) emptyMap() else adjustments(designSystemId, radii)
    return sized.map { token ->
        val components = usage[token.name].orEmpty()
        when (val kind = requireNotNull(token.kind)) {
            SizeTokenKind.SHADOW -> SizeTokenViews.shadow(token.id, token.name, token.values, components) {
                resolveColor(token.name, it)
            }
            else -> SizeTokenViews.dimension(
                token.id,
                token.name,
                kind,
                token.values,
                components,
                offsets[token.name].orEmpty(),
            )
        }
    }
}
