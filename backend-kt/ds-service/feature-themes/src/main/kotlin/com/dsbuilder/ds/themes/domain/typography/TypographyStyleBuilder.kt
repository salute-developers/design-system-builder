package com.dsbuilder.ds.themes.domain.typography

/** Сборка стилей из токенов темы. */
object TypographyStyleBuilder {
    /** Стили всех экранов; экран без стилей в ответ не попадает. */
    fun screens(
        tokens: List<StoredTypographyToken>,
        usage: Map<TypographyStyleKey, List<TypographyComponentUsage>>,
    ): List<TypographyScreenView> = TypographyScreen.entries.mapNotNull { screen ->
        tokens.filter { it.name.screen == screen }
            .groupBy { it.name.style }
            .toSortedMap()
            .map { (key, members) -> style(screen, key, members, usage[key].orEmpty()) }
            .takeIf { it.isNotEmpty() }
            ?.let { TypographyScreenView(screen, it) }
    }

    /** Стиль [key] на экране [screen] из его токенов; общие значения берутся у первого начертания. */
    fun style(
        screen: TypographyScreen,
        key: TypographyStyleKey,
        members: List<StoredTypographyToken>,
        components: List<TypographyComponentUsage>,
    ): TypographyStyleView {
        val ordered = members.sortedBy { it.name.variant.ordinal }
        val metrics = ordered.associate { it.name.variant to TypographyPlatformValues.read(it.values) }
        val base = metrics.getValue(ordered.first().name.variant)
        return TypographyStyleView(
            screen = screen,
            key = key,
            sizePx = base.sizePx,
            lineHeightPx = base.lineHeightPx,
            letterSpacingEm = base.letterSpacingEm,
            fontFamily = base.fontFamily,
            variants = ordered.associate { token ->
                token.name.variant to TypographyVariantView(
                    token.id,
                    metrics.getValue(token.name.variant).weight,
                    token.revisions.sortedBy { it.platform.ordinal },
                )
            },
            components = components,
            overrides = TypographyOverrides.of(members),
        )
    }
}
