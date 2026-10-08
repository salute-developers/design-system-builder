package com.dsbuilder.ds.themes.domain.palette

/** Вычисляет цвет ссылки токена по палитре темы — перенос `resolvePaletteStep` клиента. */
object ThemePaletteResolver {
    /** Значение ступени слота в группе: экземпляр растяжки группы, иначе копия шаблона темы. */
    fun stepInGroup(palette: ThemePalette, groupId: String, ramp: PaletteRampRef, step: Int): String? =
        palette.ramp(groupId, ramp)?.steps?.firstOrNull { it.step == step }?.value ?: templateValue(palette, ramp, step)

    /** Группа токена: явная или по умолчанию; для неизвестного палитре токена — по правилу имени. */
    fun groupOf(palette: ThemePalette, tokenName: String): String? {
        val name = DefaultPaletteGroups.stripMode(tokenName)
        return palette.tokens.firstOrNull { it.tokenName == name }?.groupId
            ?: palette.groups.firstOrNull { it.systemKey == DefaultPaletteGroups.groupFor(name) }?.id
    }

    /** HEX ссылки для токена (с прозрачностью, если она задана) или `null`. */
    fun resolve(palette: ThemePalette, tokenName: String, reference: PaletteReference): String? {
        val groupId = groupOf(palette, tokenName)
        val hex = groupId?.let { stepInGroup(palette, it, reference.ramp, reference.step) }
            ?: templateValue(palette, reference.ramp, reference.step)
        return hex?.let { PaletteColors.withOpacity(it, reference.opacity) }
    }

    private fun templateValue(palette: ThemePalette, ramp: PaletteRampRef, step: Int): String? =
        palette.template.firstOrNull { it.ramp == ramp }?.steps?.firstOrNull { it.first == step }?.second
}
