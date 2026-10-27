package com.dsbuilder.ds.themes.domain.typography

import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import kotlinx.serialization.json.JsonElement
import kotlin.math.abs

/**
 * Свои значения iOS и Android. Значения платформ строятся из веба, поэтому поле платформы считается своим, если его
 * значение отличается от значения веба: отдельного признака в данных нет, а правка веба такие поля не перезаписывает.
 */
object TypographyOverrides {
    /** Платформы, которые могут переопределять значения веба. */
    val PLATFORMS = listOf(ThemeTokenPlatform.IOS, ThemeTokenPlatform.ANDROID)

    private const val EPSILON = 1e-6

    /** Поля платформы [platform] токена, значения которых отличаются от веба. */
    fun differing(values: Map<ThemeTokenPlatform, JsonElement>, platform: ThemeTokenPlatform): Set<TypographyField> {
        val web = values[ThemeTokenPlatform.WEB] ?: return emptySet()
        val own = values[platform] ?: return emptySet()
        val webFields = TypographyPlatformValues.fields(ThemeTokenPlatform.WEB, web)
        val ownFields = TypographyPlatformValues.fields(platform, own)
        return TypographyField.entries.filterTo(mutableSetOf()) { field ->
            val a = webFields.of(field)
            val b = ownFields.of(field)
            a != null && b != null && abs(a - b) > EPSILON
        }
    }

    /** Свои значения платформ у стиля из токенов начертаний [members]; общие поля — у первого начертания. */
    fun of(members: List<StoredTypographyToken>): Map<ThemeTokenPlatform, TypographyPlatformOverride> {
        val ordered = members.sortedBy { it.name.variant.ordinal }
        val base = ordered.firstOrNull() ?: return emptyMap()
        return PLATFORMS.associateWith { platform ->
            val fields = base.values[platform]?.let { TypographyPlatformValues.fields(platform, it) }
            val differing = differing(base.values, platform)
            TypographyPlatformOverride(
                sizePx = fields?.sizePx.takeIf { TypographyField.SIZE in differing },
                lineHeightPx = fields?.lineHeightPx.takeIf { TypographyField.LINE_HEIGHT in differing },
                letterSpacingEm = fields?.letterSpacingEm.takeIf { TypographyField.LETTER_SPACING in differing },
                weights = ordered.mapNotNull { token ->
                    if (TypographyField.WEIGHT !in differing(token.values, platform)) return@mapNotNull null
                    val weight = token.values[platform]?.let { TypographyPlatformValues.fields(platform, it).weight }
                    weight?.let { token.name.variant to it }
                }.toMap(),
            )
        }.filterValues { !it.isEmpty }
    }
}
