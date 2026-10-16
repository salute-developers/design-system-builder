package com.dsbuilder.ds.themes.domain.palette

/**
 * Операции над палитрой темы — та же семантика, что у адаптера `local` клиента DS Builder. Каждая операция
 * чистая: по состоянию и текущей палитре (составу групп и связям) возвращает новое состояние с увеличенной
 * ревизией или отказ.
 */
@Suppress("TooManyFunctions")
object PaletteOperations {
    private const val MAX_LABEL = 64

    /** Новая пользовательская группа. */
    fun createGroup(state: TenantPaletteState, label: String, newId: () -> String) = attempt {
        val group = StoredPaletteGroup(newId(), PaletteGroupKind.CUSTOM, null, groupLabel(state, label, null))
        applied(state.copy(groups = state.groups + group), group)
    }

    /** Переименование пользовательской группы. */
    fun renameGroup(state: TenantPaletteState, groupId: String, label: String) = attempt {
        val group = findGroup(state, groupId)
        if (group.kind == PaletteGroupKind.SYSTEM) {
            reject(conflict(GROUP_SYSTEM, "Системную группу нельзя переименовать"))
        }
        val renamed = group.copy(label = groupLabel(state, label, groupId))
        applied(state.copy(groups = state.groups.map { if (it.id == groupId) renamed else it }), renamed)
    }

    /** Удаление пользовательской группы: растяжки уходят в Neutral, явные привязки снимаются. */
    fun deleteGroup(state: TenantPaletteState, groupId: String, palette: ThemePalette) = attempt {
        if (findGroup(state, groupId).kind == PaletteGroupKind.SYSTEM) {
            reject(conflict(GROUP_SYSTEM, "Системную группу нельзя удалить"))
        }
        val neutralId = state.systemGroupId(SystemPaletteGroup.NEUTRAL)
        // Состав Neutral — хранимые растяжки и слоты из связей токенов; при совпадении остаётся растяжка Neutral.
        val neutralSlots = palette.groups.firstOrNull { it.id == neutralId }?.ramps.orEmpty().map { it.slot }.toSet()
        val ramps = state.ramps.mapNotNull { ramp ->
            when {
                ramp.groupId != groupId -> ramp
                ramp.slot in neutralSlots -> null
                else -> ramp.copy(groupId = neutralId)
            }
        }
        applied(
            state.copy(
                groups = state.groups.filter { it.id != groupId },
                ramps = ramps,
                tokenGroups = state.tokenGroups.filterValues { it != groupId },
            ),
            Unit,
        )
    }

    /** Явная привязка токена к группе; `groupId = null` возвращает группу по правилу имени. */
    fun assignTokenGroup(
        state: TenantPaletteState,
        tokenId: String,
        groupId: String?,
        palette: ThemePalette,
    ) = attempt {
        if (palette.tokens.none { it.tokenId == tokenId }) reject(PaletteError.notFound("Цветовой токен не найден"))
        if (groupId != null) findGroup(state, groupId)
        val tokenGroups = if (groupId == null) state.tokenGroups - tokenId else state.tokenGroups + (tokenId to groupId)
        applied(state.copy(tokenGroups = tokenGroups), tokenId)
    }

    /** Добавление растяжки копии шаблона в группу. */
    fun addRamp(state: TenantPaletteState, groupId: String, slot: PaletteRampRef, palette: ThemePalette) = attempt {
        findGroup(state, groupId)
        templateSteps(state, slot)
        if (palette.ramp(groupId, slot) != null) reject(conflict(RAMP_EXISTS, "Растяжка уже есть в группе"))
        val ramp = StoredPaletteRamp(groupId, slot, slot, true, PaletteRampOrigin.TEMPLATE, null, emptyMap())
        applied(state.copy(ramps = state.ramps + ramp), slot)
    }

    /** «Поменять»: новый источник растяжки только в этой группе, правки и перестройка сбрасываются. */
    fun replaceSource(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        source: PaletteRampRef,
        palette: ThemePalette,
    ) = attempt {
        findGroup(state, groupId)
        requireRamp(palette, groupId, slot)
        missingSteps(state, source, linksOf(palette, groupId, slot))
        val ramp = stored(state, groupId, slot).copy(
            source = source,
            steps = emptyMap(),
            origin = PaletteRampOrigin.TEMPLATE,
            anchor = null,
        )
        applied(withRamp(state, ramp), slot)
    }

    /** Значения перестройки без изменения состояния. */
    fun rebuildPreview(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        anchorStep: Int,
        value: String,
        palette: ThemePalette,
    ): PaletteOperationResult<Map<Int, String>> = attempt {
        applied(state, rebuildValues(state, groupId, slot, anchorStep, value, palette))
    }

    /** «Изменить»: перестройка растяжки в группе от опорного цвета. */
    fun rebuild(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        anchorStep: Int,
        value: String,
        palette: ThemePalette,
    ) = attempt {
        val values = rebuildValues(state, groupId, slot, anchorStep, value, palette)
        val ramp = stored(state, groupId, slot).copy(
            steps = values,
            origin = PaletteRampOrigin.REBUILD,
            anchor = PaletteAnchor(anchorStep, PaletteColors.toUpperHex(value)),
        )
        applied(withRamp(state, ramp), slot)
    }

    /** Правка ступени; значение источника растяжки из шаблона снимает правку. */
    fun updateStep(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        step: Int,
        value: String,
        palette: ThemePalette,
    ) = attempt {
        findGroup(state, groupId)
        val ramp = requireRamp(palette, groupId, slot)
        if (!PaletteColors.isHexColor(value)) reject(PaletteError.invalid("Некорректный HEX"))
        if (ramp.steps.none { it.step == step }) reject(PaletteError.notFound("У растяжки нет ступени $step"))
        val edited = editedStep(state, stored(state, groupId, slot), step, PaletteColors.toUpperHex(value))
        applied(withRamp(state, edited), slot)
    }

    /** Удаление растяжки из группы: без связей, с заменой или с переводом ссылок в HEX. */
    fun removeRamp(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        strategy: RemoveRampStrategy?,
        replacement: PaletteRampRef?,
        palette: ThemePalette,
    ) = attempt {
        findGroup(state, groupId)
        requireRamp(palette, groupId, slot)
        val linked = linksOf(palette, groupId, slot)
        if (linked.isNotEmpty() && strategy == null) {
            reject(conflict(RAMP_LINKED, "У растяжки есть связанные токены"))
        }
        val target = replacement.takeIf { strategy == RemoveRampStrategy.REPLACE }
        if (strategy == RemoveRampStrategy.REPLACE) {
            missingSteps(state, target ?: reject(PaletteError.invalid("Не выбрана растяжка замены")), linked)
        }
        val ramps = state.ramps.filterNot { it.groupId == groupId && it.slot == slot }.toMutableList()
        if (target != null && ramps.none { it.groupId == groupId && it.slot == target }) {
            ramps += StoredPaletteRamp(groupId, target, target, true, PaletteRampOrigin.TEMPLATE, null, emptyMap())
        }
        val rewrite = linked.takeIf { it.isNotEmpty() }?.let { links ->
            TokenReferenceRewrite(links.map { it.tokenId }.distinct(), slot, target)
        }
        applied(state.copy(ramps = ramps), RemovedRamp(linked.size, rewrite))
    }

    /** Свободное имя новой группы: «Новая группа», «Новая группа 2», … */
    fun nextGroupLabel(groups: List<StoredPaletteGroup>, base: String = "Новая группа"): String {
        val taken = groups.map { it.label.lowercase() }.toSet()
        if (base.lowercase() !in taken) return base
        return generateSequence(2) { it + 1 }.map { "$base $it" }.first { it.lowercase() !in taken }
    }

    private fun editedStep(
        state: TenantPaletteState,
        ramp: StoredPaletteRamp,
        step: Int,
        hex: String,
    ): StoredPaletteRamp {
        val sourceValue = state.template[ramp.source]?.get(step)?.let(PaletteColors::toUpperHex)
        // Значение источника — это сброс правки, а не новая правка: иначе «Изменена» и «вне бренда» не снять.
        if (ramp.origin == PaletteRampOrigin.TEMPLATE && sourceValue == hex) {
            return ramp.copy(steps = ramp.steps - step)
        }
        val rebuiltAnchor = ramp.origin == PaletteRampOrigin.REBUILD && ramp.anchor?.step == step
        val anchor = if (rebuiltAnchor) PaletteAnchor(step, hex) else ramp.anchor
        return ramp.copy(steps = ramp.steps + (step to hex), anchor = anchor)
    }

    private fun rebuildValues(
        state: TenantPaletteState,
        groupId: String,
        slot: PaletteRampRef,
        anchorStep: Int,
        value: String,
        palette: ThemePalette,
    ): Map<Int, String> {
        findGroup(state, groupId)
        val ramp = requireRamp(palette, groupId, slot)
        if (!PaletteColors.isHexColor(value)) reject(PaletteError.invalid("Некорректный HEX опорного цвета"))
        val source = templateSteps(state, ramp.source)
        return PaletteRampRebuilder.rebuild(source, anchorStep, PaletteColors.toUpperHex(value))
            ?: reject(PaletteError.invalid("У источника нет ступени $anchorStep"))
    }

    private fun groupLabel(state: TenantPaletteState, label: String, exceptId: String?): String {
        val trimmed = label.trim()
        if (trimmed.isEmpty() || trimmed.length > MAX_LABEL) {
            reject(PaletteError.invalid("Название группы должно содержать от 1 до $MAX_LABEL символов"))
        }
        if (state.groups.any { it.id != exceptId && it.label.lowercase() == trimmed.lowercase() }) {
            reject(conflict(GROUP_EXISTS, "Группа «$trimmed» уже есть"))
        }
        return trimmed
    }

    private fun missingSteps(state: TenantPaletteState, source: PaletteRampRef, links: List<PaletteLink>) {
        val steps = templateSteps(state, source)
        val missing = links.map { it.step }.distinct().sorted().filter { it !in steps }
        if (missing.isNotEmpty()) {
            reject(conflict(STEP_MISSING, "В новой растяжке нет используемых ступеней", missing))
        }
    }

    private fun findGroup(state: TenantPaletteState, groupId: String): StoredPaletteGroup =
        state.groups.firstOrNull { it.id == groupId } ?: reject(PaletteError.notFound("Группа палитры не найдена"))

    private fun templateSteps(state: TenantPaletteState, ramp: PaletteRampRef): Map<Int, String> =
        state.template[ramp] ?: reject(PaletteError.notFound("Растяжки ${ramp.key} нет в палитре темы"))

    private fun requireRamp(palette: ThemePalette, groupId: String, slot: PaletteRampRef): PaletteRampView =
        palette.ramp(groupId, slot) ?: reject(PaletteError.notFound("Растяжки нет в группе"))

    private fun linksOf(palette: ThemePalette, groupId: String, slot: PaletteRampRef) =
        palette.links.filter { it.groupId == groupId && it.slot == slot }

    private fun stored(state: TenantPaletteState, groupId: String, slot: PaletteRampRef): StoredPaletteRamp =
        state.ramps.firstOrNull { it.groupId == groupId && it.slot == slot }
            ?: StoredPaletteRamp(groupId, slot, slot, false, PaletteRampOrigin.TEMPLATE, null, emptyMap())

    private fun withRamp(state: TenantPaletteState, ramp: StoredPaletteRamp): TenantPaletteState {
        val others = state.ramps.filterNot { it.groupId == ramp.groupId && it.slot == ramp.slot }
        val index = state.ramps.indexOfFirst { it.groupId == ramp.groupId && it.slot == ramp.slot }
        return state.copy(ramps = if (index < 0) others + ramp else others.toMutableList().apply { add(index, ramp) })
    }

    private fun <T> applied(state: TenantPaletteState, value: T): PaletteOperationResult<T> =
        PaletteOperationResult.Applied(state.copy(editRevision = state.editRevision + 1), value)

    private fun conflict(code: String, message: String, steps: List<Int> = emptyList()) =
        PaletteError.conflict(code, message, steps)

    private fun reject(error: PaletteError): Nothing = throw Rejection(error)

    private inline fun <T> attempt(block: () -> PaletteOperationResult<T>): PaletteOperationResult<T> = try {
        block()
    } catch (rejection: Rejection) {
        PaletteOperationResult.Rejected(rejection.error)
    }

    private class Rejection(val error: PaletteError) : RuntimeException(error.message)

    /** Группа с таким названием уже есть. */
    const val GROUP_EXISTS = "PALETTE_GROUP_EXISTS"

    /** Системную группу нельзя удалить или переименовать. */
    const val GROUP_SYSTEM = "PALETTE_GROUP_SYSTEM"

    /** Растяжка уже есть в группе. */
    const val RAMP_EXISTS = "PALETTE_RAMP_EXISTS"

    /** У растяжки есть связанные токены. */
    const val RAMP_LINKED = "PALETTE_RAMP_LINKED"

    /** В новой растяжке нет используемых ступеней. */
    const val STEP_MISSING = "PALETTE_STEP_MISSING"
}
