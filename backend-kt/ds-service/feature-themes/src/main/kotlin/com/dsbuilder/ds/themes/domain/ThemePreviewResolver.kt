package com.dsbuilder.ds.themes.domain

/** Вычисляет fallback-preview без обращения к инфраструктуре. */
object ThemePreviewResolver {
    /** Возвращает preview для сохранённой цветовой конфигурации. */
    fun resolve(configuration: ColorConfiguration): ThemePreview = when (configuration.profile) {
        ThemeProfile.SBER -> ThemePreview("#108E26", "#FFFFFF", "#FFFFFF", "#1A9E32", "#101010")
        ThemeProfile.MALACHITE -> ThemePreview("#107F8C", "#FFFFFF", "#F7F9F8", "#19B9A5", "#111614")
        ThemeProfile.B2B -> ThemePreview("#1B1D22", "#FFFFFF", "#F6F8FC", "#F8FAFC", "#111827")
        ThemeProfile.CUSTOM -> configuration.customPalette?.let {
            ThemePreview(it.primary, it.onPrimary, it.background, it.primary, "#171717")
        } ?: DEFAULT
        null -> DEFAULT
    }

    private val DEFAULT = ThemePreview("#2563EB", "#FFFFFF", "#F6F8FC", "#60A5FA", "#111827")
}
