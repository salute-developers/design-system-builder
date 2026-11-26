package com.dsbuilder.ds.themes.domain.palette

/** Раскрывает цвета по состоянию темы без построения связей и представления палитры. */
class TenantPaletteValueResolver(
    private val state: TenantPaletteState,
    tokens: List<PaletteTokenRef>,
) {
    private val groups = state.groups.associateBy { it.id }
    private val systemGroups = state.groups.associate { it.systemKey to it.id }
    private val ramps = state.ramps.associateBy { it.groupId to it.slot }
    private val tokenGroups = buildMap {
        tokens.forEach { token ->
            val explicit = state.tokenGroups[token.id]?.takeIf { it in groups }
            putIfAbsent(token.name, explicit ?: state.systemGroupId(DefaultPaletteGroups.groupFor(token.name)))
        }
    }

    /** Возвращает цвет ссылки с прежними правилами групп, источников и прозрачности. */
    fun resolve(tokenName: String, reference: PaletteReference): String? {
        val name = DefaultPaletteGroups.stripMode(tokenName)
        val group = tokenGroups[name] ?: systemGroups[DefaultPaletteGroups.groupFor(name)]
        val ramp = group?.let { ramps[it to reference.ramp] }
        val template = state.template[reference.ramp]?.get(reference.step)
        val source = ramp?.let { state.template[it.source]?.get(reference.step) }
        // Полная палитра показывает только пересечение ступеней источника и слота.
        val color = if (source != null && template != null) ramp?.steps?.get(reference.step) ?: source else template
        return color?.let { PaletteColors.withOpacity(it, reference.opacity) }
    }
}
