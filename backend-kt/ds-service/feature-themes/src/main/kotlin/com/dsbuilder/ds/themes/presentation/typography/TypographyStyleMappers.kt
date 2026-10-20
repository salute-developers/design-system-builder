package com.dsbuilder.ds.themes.presentation.typography

import com.dsbuilder.ds.themes.application.typography.UpdatedTypographyStyle
import com.dsbuilder.ds.themes.application.typography.WrittenTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyComponentUsage
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyScreenView
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleView
import com.dsbuilder.ds.themes.domain.typography.TypographyStyles

/** Ответ чтения стилей. */
internal fun TypographyStyles.toResponse() = TypographyStylesResponse(
    editRevision = editRevision,
    canEdit = canEdit,
    themeCount = themeCount,
    families = families.map { it.toDto() },
    screens = screens.map { it.toDto() },
)

/** Ответ изменения стиля. */
internal fun UpdatedTypographyStyle.toResponse() = UpdatedTypographyStyleResponse(
    editRevision = editRevision,
    style = style.toDto(),
    tokens = tokens.map { it.toDto() },
)

private fun TypographyFamily.toDto() = TypographyFamilyDto(name, fontName)

private fun TypographyScreenView.toDto() = TypographyScreenDto(screen.wireValue, styles.map { it.toDto() })

private fun TypographyStyleView.toDto() = TypographyStyleDto(
    screen = screen.wireValue,
    group = key.group,
    size = key.size,
    sizePx = sizePx,
    lineHeightPx = lineHeightPx,
    letterSpacingEm = letterSpacingEm,
    fontFamily = fontFamily,
    variants = variants.entries.associate { (variant, view) ->
        variant.wireValue to TypographyVariantDto(view.tokenId.toString(), view.weight)
    },
    components = components.map { it.toDto() },
)

private fun TypographyComponentUsage.toDto() = TypographyComponentDto(name, count)

private fun WrittenTypographyToken.toDto() = TypographyTokenValuesDto(
    tokenId = tokenId.toString(),
    name = name,
    values = values.entries.map { (platform, value) -> TypographyPlatformValueDto(platform.wireValue, value) },
)
