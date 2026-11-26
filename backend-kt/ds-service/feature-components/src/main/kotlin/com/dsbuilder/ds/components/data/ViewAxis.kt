package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.core.data.lockDraftSubject
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Вариация цветовой схемы `view` у каждой конфигурации компонента.
 *
 * Роль цветовой схемы не назначается: блокировку `view` даёт клиент по имени вариации в каталоге компонента.
 */
internal object ViewAxis {
    /** Имя вариации цветовой схемы в каталоге компонента; сравнивается без учёта регистра. */
    const val NAME = "view"

    /** Значение вариации `view`, которое получает конфигурация без неё. */
    const val DEFAULT_VALUE = "default"

    /**
     * Добавляет конфигурации [appearanceId] ось `view` последней со значением `default` по умолчанию, если у неё нет
     * оси, чья вариация в каталоге называется `view`. Пишет те же редакции текущего черновика, что и создание
     * конфигурации в редакторе. Возвращает `true`, если что-то записано.
     */
    fun ensure(designSystemId: UUID, componentId: UUID, appearanceId: UUID): Boolean {
        val axes = AppearanceVariationsTable.selectAll()
            .where { AppearanceVariationsTable.appearanceId eq appearanceId }.toList()
        if (hasView(axes.map { it[AppearanceVariationsTable.variationId] })) return false
        val variationId = VariationWrites.findOrCreate(designSystemId, componentId, NAME, ignoreCase = true)
        val styleId = ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.designSystemId eq designSystemId) and
                (ComponentStylesTable.variationId eq variationId) and
                (ComponentStylesTable.name eq DEFAULT_VALUE)
        }.singleOrNull()?.get(ComponentStylesTable.id)
            ?: EditorWrites.newStyle(designSystemId, variationId, DEFAULT_VALUE)
        // Позиции осей могут идти с пропусками, поэтому новая ось встаёт за последней, а не на их число.
        val position = (axes.maxOfOrNull { it[AppearanceVariationsTable.position] } ?: -1) + 1
        val axisId = removedAxis(appearanceId, variationId)
            ?.also { restoreAxis(designSystemId, it, position, styleId) }
            ?: EditorWrites.newAxis(designSystemId, appearanceId, variationId, position, styleId, null, null)
        val values = AppearanceVariationValuesTable.selectAll()
            .where { AppearanceVariationValuesTable.appearanceVariationId eq axisId }.toList()
        if (values.none { it[AppearanceVariationValuesTable.styleId] == styleId }) {
            val valuePosition = (values.maxOfOrNull { it[AppearanceVariationValuesTable.position] } ?: -1) + 1
            EditorWrites.newAxisValue(designSystemId, axisId, styleId, valuePosition, null, null)
        }
        // Корень не меняется, если он уже есть; у конфигурации без осей им по правилу фолбэка становится `view`,
        // как при импорте и из шаблона, иначе выгрузка и повторная загрузка разошлись бы.
        AppearanceAxisRoleStore.ensureRoot(appearanceId)
        return true
    }

    /** Удалённая в черновике ось той же вариации: устойчивая строка пары конфигурация–вариация уникальна. */
    private fun removedAxis(appearanceId: UUID, variationId: UUID): UUID? =
        StableAppearanceVariationsTable.selectAll().where {
            (StableAppearanceVariationsTable.appearanceId eq appearanceId) and
                (StableAppearanceVariationsTable.variationId eq variationId)
        }.singleOrNull()?.get(StableAppearanceVariationsTable.id)

    /** Возвращает удалённую ось новой редакцией черновика в конец осей. */
    private fun restoreAxis(designSystemId: UUID, axisId: UUID, position: Int, styleId: UUID) {
        check(lockDraftSubject(designSystemId, "appearance-variation", axisId)) { "Appearance axis is missing" }
        AppearanceVariationRevisionsTable.replaceRevision(
            AppearanceVariationRevisionsTable.entityId,
            axisId,
            designSystemId,
        ) {
            it[AppearanceVariationRevisionsTable.position] = position
            it[defaultStyleId] = styleId
            it[declaredType] = null
            it[displayName] = null
        }
    }

    private fun hasView(variationIds: List<UUID>): Boolean = variationIds.isNotEmpty() &&
        VariationsTable.selectAll().where {
            (VariationsTable.id inList variationIds) and (VariationsTable.name.lowerCase() eq NAME)
        }.any()
}
