package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Предметные правила операций редактора оформления, общие для прежних маршрутов и операций редактора. */
internal object AppearanceEditorRules {
    /** Действующее имя оси: отображаемое имя оформления либо имя вариации каталога. */
    fun axisName(displayName: String?, catalogName: String): String =
        displayName?.takeIf { it.isNotBlank() } ?: catalogName

    /** Ось цветовой схемы заблокирована: её нельзя удалить и переименовать. */
    fun isLocked(appearanceId: UUID, variationId: UUID): Boolean =
        AppearanceAxisRoleStore.load(listOf(appearanceId))[appearanceId]?.colorScheme == variationId

    /** Отклоняет удаление оси цветовой схемы. */
    fun checkAxisRemovable(axis: ResultRow) {
        if (isLocked(axis[AppearanceVariationsTable.appearanceId], axis[AppearanceVariationsTable.variationId])) {
            throw EditorRuleViolationException("axis_locked", "The color scheme axis cannot be removed")
        }
    }

    /** Прежние маршруты удаления не каскадируют: при зависимых значениях или ссылках они отказывают. */
    fun checkNoDependents(designSystemId: UUID, appearanceId: UUID, styleIds: Collection<UUID>) {
        if (StyleDependents.collect(designSystemId, appearanceId, styleIds, confirmCascade = false).count > 0) {
            throw EditorRuleViolationException(
                "dependent_values_exist",
                "The axis or value carries property values; remove it with the editor operation",
            )
        }
    }

    /** Отклоняет переименование заблокированной оси и совпадение имени с другой осью оформления. */
    fun checkAxisRename(axis: ResultRow, newDisplayName: String?) {
        val appearanceId = axis[AppearanceVariationsTable.appearanceId]
        if (isLocked(appearanceId, axis[AppearanceVariationsTable.variationId])) {
            throw EditorRuleViolationException("axis_locked", "The color scheme axis cannot be renamed")
        }
        val catalogName = variationCatalogName(axis[AppearanceVariationsTable.variationId])
        val target = axisName(newDisplayName, catalogName).trim().lowercase()
        val taken = axisNames(appearanceId, excluding = axis[AppearanceVariationsTable.id]).any { it == target }
        if (taken) throw EditorRuleViolationException("axis_name_taken", "The axis name is already used")
    }

    /** Отклоняет удаление единственного значения заблокированной оси. */
    fun checkValueRemovable(axis: ResultRow) {
        if (!isLocked(axis[AppearanceVariationsTable.appearanceId], axis[AppearanceVariationsTable.variationId])) return
        val count = AppearanceVariationValuesTable.selectAll()
            .where { AppearanceVariationValuesTable.appearanceVariationId eq axis[AppearanceVariationsTable.id] }
            .count()
        if (count <= 1) {
            throw EditorRuleViolationException(
                "axis_locked",
                "The only value of the color scheme axis cannot be removed",
            )
        }
    }

    /** Отклоняет совпадение действующего имени значения с другим значением той же оси. */
    fun checkValueRename(value: ResultRow, newDisplayName: String?) {
        val styleName = ComponentStylesTable.selectAll()
            .where { ComponentStylesTable.id eq value[AppearanceVariationValuesTable.styleId] }
            .single()[ComponentStylesTable.name]
        val target = axisName(newDisplayName, styleName).trim().lowercase()
        val axisId = value[AppearanceVariationValuesTable.appearanceVariationId]
        val taken = valueNames(axisId, value[AppearanceVariationValuesTable.id])
            .any { it == target }
        if (taken) throw EditorRuleViolationException("value_name_taken", "The value name is already used in the axis")
    }

    /** Отклоняет удаление конфигурации по умолчанию. */
    fun checkAppearanceRemovable(appearance: ResultRow) {
        if (appearance[ComponentAppearancesTable.isDefault]) {
            throw EditorRuleViolationException(
                "default_appearance_protected",
                "The default configuration cannot be removed",
            )
        }
    }

    private fun variationCatalogName(variationId: UUID): String =
        VariationsTable.selectAll().where { VariationsTable.id eq variationId }.single()[VariationsTable.name]

    /** Действующие имена осей оформления в нижнем регистре, кроме оси [excluding]. */
    fun axisNames(appearanceId: UUID, excluding: UUID?): List<String> =
        AppearanceVariationsTable.join(
            VariationsTable,
            JoinType.INNER,
            AppearanceVariationsTable.variationId,
            VariationsTable.id,
        ).selectAll().where { AppearanceVariationsTable.appearanceId eq appearanceId }
            .filter { it[AppearanceVariationsTable.id] != excluding }
            .map { axisName(it[AppearanceVariationsTable.displayName], it[VariationsTable.name]).trim().lowercase() }

    /** Действующие имена значений оси в нижнем регистре, кроме значения [excluding]. */
    fun valueNames(axisId: UUID, excluding: UUID?): List<String> =
        AppearanceVariationValuesTable.join(
            ComponentStylesTable,
            JoinType.INNER,
            AppearanceVariationValuesTable.styleId,
            ComponentStylesTable.id,
        ).selectAll().where { AppearanceVariationValuesTable.appearanceVariationId eq axisId }
            .filter { it[AppearanceVariationValuesTable.id] != excluding }
            .map {
                axisName(it[AppearanceVariationValuesTable.displayName], it[ComponentStylesTable.name])
                    .trim().lowercase()
            }
}

/** Правила имён и входящих ссылок конфигураций (оформлений). */
internal object AppearanceNaming {
    private const val MAX_NAME_LENGTH = 255

    /** Нормализованные имена оформлений пары (дизайн-система, компонент), кроме [excluding]. */
    fun names(designSystemId: UUID, componentId: UUID, excluding: UUID? = null): Set<String> =
        ComponentAppearancesTable.selectAll().where {
            (ComponentAppearancesTable.designSystemId eq designSystemId) and
                (ComponentAppearancesTable.componentId eq componentId)
        }.filter { it[ComponentAppearancesTable.id] != excluding }
            .mapNotNull { it[ComponentAppearancesTable.name]?.trim()?.lowercase() }.toSet()

    /** Проверяет имя и его уникальность в паре. */
    fun requireFree(designSystemId: UUID, componentId: UUID, rawName: String, excluding: UUID? = null): String {
        val name = rawName.trim()
        if (name.isEmpty() || name.length > MAX_NAME_LENGTH) {
            throw EditorRuleViolationException("appearance_name_invalid", "The configuration name is empty or too long")
        }
        if (name.lowercase() in names(designSystemId, componentId, excluding)) {
            throw EditorRuleViolationException("appearance_name_taken", "The configuration name is already used")
        }
        return name
    }

    /** Свободное имя вида `<основа>` либо `<основа> 2`, `<основа> 3`. */
    fun freeName(designSystemId: UUID, componentId: UUID, base: String): String {
        val taken = names(designSystemId, componentId)
        if (base.lowercase() !in taken) return base
        return generateSequence(2) { it + 1 }.map { "$base $it" }.first { it.lowercase() !in taken }
    }

    /** Отклоняет удаление оформления, на которое ссылаются значения других оформлений. */
    fun checkNotReferenced(appearanceId: UUID) {
        val count = ComponentStyleReferencesTable.selectAll()
            .where { ComponentStyleReferencesTable.targetAppearanceId eq appearanceId }.count()
        if (count > 0) {
            throw EditorRuleViolationException(
                "reference_in_use",
                "$count reference(s) from other configurations point to this configuration",
                conflict = true,
            )
        }
    }
}
