package com.dsbuilder.ds.themes.domain.palette

/** Собирает палитру темы из состояния, токенов и их значений — перенос `buildThemePalette` клиента. */
object ThemePaletteBuilder {
    /** Палитра темы со связями токенов. */
    fun build(
        tenantId: String,
        canEdit: Boolean,
        state: TenantPaletteState,
        tokens: List<PaletteTokenRef>,
        values: List<PaletteTokenValue>,
    ): ThemePalette {
        val assignments = assign(state, tokens)
        val links = links(state, tokens, values, assignments)
        val groups = order(state).map { group -> groupView(state, group, links.filter { it.groupId == group.id }) }
        val offBrand = state.ramps.any { it.steps.isNotEmpty() || it.slot != it.source }
        val template = state.template.keys.sortedWith(PaletteRampOrder).map { ramp ->
            val steps = state.template.getValue(ramp).toSortedMap().map { (step, value) -> step to value }
            PaletteTemplateRamp(ramp, steps)
        }
        return ThemePalette(tenantId, state.editRevision, canEdit, offBrand, groups, assignments, template, links)
    }

    /** Принадлежность токенов: явная привязка к существующей группе или группа по правилу имени. */
    fun assign(state: TenantPaletteState, tokens: List<PaletteTokenRef>): List<PaletteTokenAssignment> {
        val groupIds = state.groups.map { it.id }.toSet()
        return tokens.map { token ->
            val explicit = state.tokenGroups[token.id]?.takeIf { it in groupIds }
            PaletteTokenAssignment(
                tokenId = token.id,
                tokenName = token.name,
                groupId = explicit ?: state.systemGroupId(DefaultPaletteGroups.groupFor(token.name)),
                explicit = explicit != null,
            )
        }
    }

    private fun links(
        state: TenantPaletteState,
        tokens: List<PaletteTokenRef>,
        values: List<PaletteTokenValue>,
        assignments: List<PaletteTokenAssignment>,
    ): List<PaletteLink> {
        val tokenById = tokens.associateBy { it.id }
        val groupByToken = assignments.associate { it.tokenId to it.groupId }
        val links = LinkedHashMap<String, PaletteLink>()
        val resolvable = values.filter { value ->
            val reference = value.reference
            val known = reference != null && state.template[reference.ramp]?.containsKey(reference.step) == true
            value.tokenId in tokenById && known
        }
        for (value in resolvable) {
            val token = tokenById.getValue(value.tokenId)
            val reference = requireNotNull(value.reference)
            val key = listOf(token.id, value.mode.orEmpty(), reference.ramp.key, reference.step).joinToString("|")
            val existing = links[key]
            links[key] = existing?.withPlatform(value.platform) ?: PaletteLink(
                tokenId = token.id,
                tokenName = token.name,
                displayName = token.displayName,
                groupId = groupByToken.getValue(token.id),
                mode = value.mode,
                slot = reference.ramp,
                step = reference.step,
                opacity = reference.opacity,
                platforms = listOf(value.platform),
            )
        }
        return links.values.toList()
    }

    private fun order(state: TenantPaletteState): List<StoredPaletteGroup> =
        SystemPaletteGroup.entries.map { key -> state.groups.first { it.systemKey == key } } +
            state.groups.filter { it.kind == PaletteGroupKind.CUSTOM }

    private fun PaletteLink.withPlatform(platform: String): PaletteLink =
        if (platform in platforms) this else copy(platforms = platforms + platform)

    private fun groupView(
        state: TenantPaletteState,
        group: StoredPaletteGroup,
        links: List<PaletteLink>,
    ): PaletteGroupView {
        val stored = LinkedHashMap<PaletteRampRef, StoredPaletteRamp>()
        state.ramps.filter { it.groupId == group.id }.forEach { stored[it.slot] = it }
        links.forEach { link -> stored.getOrPut(link.slot) { defaultRamp(group.id, link.slot) } }
        val ramps = stored.values
            .sortedWith(compareBy(PaletteRampOrder) { it.slot })
            .mapNotNull { rampView(state, it, links) }
        return PaletteGroupView(group.id, group.kind, group.systemKey, group.label, ramps)
    }

    private fun defaultRamp(groupId: String, slot: PaletteRampRef) =
        StoredPaletteRamp(groupId, slot, slot, false, PaletteRampOrigin.TEMPLATE, null, emptyMap())

    private fun rampView(
        state: TenantPaletteState,
        stored: StoredPaletteRamp,
        links: List<PaletteLink>,
    ): PaletteRampView? {
        val source = state.template[stored.source] ?: return null
        val slotSteps = state.template[stored.slot] ?: return null
        val rampLinks = links.filter { it.slot == stored.slot }
        // Ссылка токена указывает на ступень слота: у растяжки только ступени слота, которые есть у источника.
        val steps = source.keys.filter { it in slotSteps }.sorted().map { step ->
            val templateValue = source.getValue(step)
            val override = stored.steps[step]
            val linked = pairs(rampLinks.filter { it.step == step })
            PaletteStepView(step, override ?: templateValue, templateValue, override != null, linked)
        }
        return PaletteRampView(
            slot = stored.slot,
            source = stored.source,
            displayName = PaletteDisplayNames.of(stored.source, rebuildAnchor(stored)),
            origin = stored.origin,
            anchor = stored.anchor,
            added = stored.added,
            modified = stored.steps.isNotEmpty(),
            linkedCount = pairs(rampLinks),
            steps = steps,
        )
    }

    private fun rebuildAnchor(stored: StoredPaletteRamp): PaletteAnchor? =
        stored.anchor.takeIf { stored.origin == PaletteRampOrigin.REBUILD }

    private fun pairs(links: List<PaletteLink>): Int = links.map { it.tokenId to it.mode }.toSet().size
}
