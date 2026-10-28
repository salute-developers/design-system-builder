package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Операции редактора над осями оформления и их значениями. */
@Suppress("TooManyFunctions")
internal object AppearanceEditorAxisOperations {
    private const val MAX_NAME_LENGTH = 255

    @Suppress("ThrowsCount")
    fun addAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.AxisCreate,
    ): EditorAxis? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val name = validName(command.name, "axis_name_invalid")
        val valueNames = command.values.map { validName(it, "value_name_invalid") }
        if (valueNames.map { it.lowercase() }.distinct().size != valueNames.size) {
            throw EditorRuleViolationException("value_name_taken", "Axis values must have distinct names")
        }
        if (AppearanceEditorRules.axisNames(appearanceId, excluding = null).any { it == name.lowercase() }) {
            throw EditorRuleViolationException("axis_name_taken", "The axis name is already used")
        }
        val existing = orderedAxes(appearanceId)
        lockAxes(designSystemId, existing)
        val position = (command.position ?: existing.size).coerceIn(0, existing.size)
        val variationId = newVariation(designSystemId, appearance[ComponentAppearancesTable.componentId], name)
        val styles = valueNames.associateWith { EditorWrites.newStyle(designSystemId, variationId, it) }
        val defaultStyle = command.defaultValue?.let { wanted ->
            styles.entries.firstOrNull { it.key.equals(wanted.trim(), ignoreCase = true) }?.value
                ?: throw EditorRuleViolationException(
                    "default_value_unknown",
                    "The default value is not among the axis values",
                )
        } ?: styles.values.firstOrNull()
        existing.drop(position).forEachIndexed { index, axis ->
            EditorWrites.moveAxis(designSystemId, axis, position + 1 + index)
        }
        val technical = VariationsTable.selectAll()
            .where { VariationsTable.id eq variationId }.single()[VariationsTable.name]
        val axisId = EditorWrites.newAxis(
            designSystemId,
            appearanceId,
            variationId,
            position,
            defaultStyle,
            null,
            displayName = name.takeIf { it != technical },
        )
        valueNames.forEachIndexed { index, valueName ->
            EditorWrites.newAxisValue(designSystemId, axisId, styles.getValue(valueName), index, null, null)
        }
        AppearanceAxisRoleStore.ensureRoot(appearanceId)
        StyleReferenceWriter.rebuildTexts(designSystemId, appearanceId)
        return AppearanceEditorModelReader.axes(appearanceId, designSystemId, null).first { it.id == axisId }
    }

    fun removeAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val axis = axisRow(appearanceId, axisId) ?: return null
        AppearanceEditorRules.checkAxisRemovable(axis)
        val values = valueRows(axisId)
        val dependents = StyleDependents.collect(
            designSystemId,
            appearanceId,
            values.map { it[AppearanceVariationValuesTable.styleId] },
            confirmCascade,
        ) { EditorSupport.writableAppearance(projectId, systemAdmin, it) != null }
        val remaining = orderedAxes(appearanceId).filter { it[AppearanceVariationsTable.id] != axisId }
        lockAxes(designSystemId, orderedAxes(appearanceId))
        lockValues(designSystemId, values)
        dependents.lock()
        dependents.remove()
        values.forEach { EditorWrites.removeAxisValue(designSystemId, it) }
        val variationId = axis[AppearanceVariationsTable.variationId]
        val roles = AppearanceAxisRoleStore.load(listOf(appearanceId))[appearanceId]
        if (roles?.root == variationId) {
            AppearanceAxisRoleStore.apply(appearanceId, variationId, root = false, colorScheme = null)
        }
        EditorWrites.removeAxis(designSystemId, axis)
        remaining.forEachIndexed { index, row -> EditorWrites.moveAxis(designSystemId, row, index) }
        AppearanceAxisRoleStore.ensureRoot(appearanceId)
        return EditorRemoval(dependents.count)
    }

    fun reorderAxes(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisIds: List<UUID>,
    ): List<EditorAxis>? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val current = orderedAxes(appearanceId)
        val currentIds = current.map { it[AppearanceVariationsTable.id] }
        if (axisIds.size != current.size || axisIds.toSet() != currentIds.toSet()) {
            throw EditorRuleViolationException(
                "invalid_order",
                "The order must list every axis of the configuration once",
            )
        }
        lockAxes(designSystemId, current)
        val byId = current.associateBy { it[AppearanceVariationsTable.id] }
        axisIds.forEachIndexed { index, id -> EditorWrites.moveAxis(designSystemId, byId.getValue(id), index) }
        // Текст ссылок на оформление следует порядку его осей.
        StyleReferenceWriter.rebuildTexts(designSystemId, appearanceId)
        return AppearanceEditorModelReader.axes(appearanceId, designSystemId, null)
    }

    fun addAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        command: AppearanceEditorRepository.AxisValueCreate,
    ): EditorAxisValue? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val axis = axisRow(appearanceId, axisId) ?: return null
        val name = validName(command.name, "value_name_invalid")
        if (AppearanceEditorRules.valueNames(axisId, excluding = null).any { it == name.lowercase() }) {
            throw EditorRuleViolationException("value_name_taken", "The value name is already used in the axis")
        }
        val values = valueRows(axisId)
        lockValues(designSystemId, values)
        val position = (command.position ?: values.size).coerceIn(0, values.size)
        values.drop(position).forEachIndexed { index, row ->
            EditorWrites.moveAxisValue(designSystemId, row, position + 1 + index)
        }
        val variationId = axis[AppearanceVariationsTable.variationId]
        val declaredStyles = values.map { it[AppearanceVariationValuesTable.styleId] }.toSet()
        val styleId = reusableStyle(designSystemId, variationId, name, declaredStyles)
            ?: EditorWrites.newStyle(designSystemId, variationId, freeStyleName(designSystemId, variationId, name))
        val technical = ComponentStylesTable.selectAll()
            .where { ComponentStylesTable.id eq styleId }.single()[ComponentStylesTable.name]
        val valueId = EditorWrites.newAxisValue(
            designSystemId,
            axisId,
            styleId,
            position,
            null,
            displayName = name.takeIf { it != technical },
        )
        return AppearanceEditorModelReader.axes(appearanceId, designSystemId, null)
            .flatMap { it.values }.first { it.id == valueId }
    }

    @Suppress("ReturnCount")
    fun removeAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        valueId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        val value = AppearanceVariationValuesTable.selectAll()
            .where { AppearanceVariationValuesTable.id eq valueId }.singleOrNull() ?: return null
        val axis = axisRow(appearanceId, value[AppearanceVariationValuesTable.appearanceVariationId]) ?: return null
        AppearanceEditorRules.checkValueRemovable(axis)
        val styleId = value[AppearanceVariationValuesTable.styleId]
        val dependents = StyleDependents.collect(designSystemId, appearanceId, listOf(styleId), confirmCascade) {
            EditorSupport.writableAppearance(projectId, systemAdmin, it) != null
        }
        val siblings = valueRows(axis[AppearanceVariationsTable.id])
        check(lockDraftSubjects(designSystemId, "appearance-variation", listOf(axis[AppearanceVariationsTable.id])))
        lockValues(designSystemId, siblings)
        dependents.lock()
        dependents.remove()
        if (axis[AppearanceVariationsTable.defaultStyleId] == styleId) {
            EditorWrites.clearAxisDefault(designSystemId, axis)
        }
        EditorWrites.removeAxisValue(designSystemId, value)
        siblings.filter { it[AppearanceVariationValuesTable.id] != valueId }
            .forEachIndexed { index, row -> EditorWrites.moveAxisValue(designSystemId, row, index) }
        return EditorRemoval(dependents.count)
    }

    fun reorderAxisValues(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        valueIds: List<UUID>,
    ): EditorAxis? {
        val appearance = EditorSupport.writableAppearance(projectId, systemAdmin, appearanceId) ?: return null
        val designSystemId = appearance[ComponentAppearancesTable.designSystemId]
        axisRow(appearanceId, axisId) ?: return null
        val values = valueRows(axisId)
        val currentValueIds = values.map { it[AppearanceVariationValuesTable.id] }
        if (valueIds.size != values.size || valueIds.toSet() != currentValueIds.toSet()) {
            throw EditorRuleViolationException("invalid_order", "The order must list every value of the axis once")
        }
        lockValues(designSystemId, values)
        val byId = values.associateBy { it[AppearanceVariationValuesTable.id] }
        valueIds.forEachIndexed { index, id -> EditorWrites.moveAxisValue(designSystemId, byId.getValue(id), index) }
        return AppearanceEditorModelReader.axes(appearanceId, designSystemId, null).first { it.id == axisId }
    }

    private fun validName(raw: String, code: String): String {
        val name = raw.trim()
        if (name.isEmpty() || name.length > MAX_NAME_LENGTH) {
            throw EditorRuleViolationException(code, "The name is empty or too long")
        }
        return name
    }

    private fun orderedAxes(appearanceId: UUID): List<ResultRow> = AppearanceVariationsTable.selectAll()
        .where { AppearanceVariationsTable.appearanceId eq appearanceId }
        .orderBy(AppearanceVariationsTable.position).toList()

    private fun axisRow(appearanceId: UUID, axisId: UUID): ResultRow? = AppearanceVariationsTable.selectAll().where {
        (AppearanceVariationsTable.id eq axisId) and (AppearanceVariationsTable.appearanceId eq appearanceId)
    }.singleOrNull()

    private fun valueRows(axisId: UUID): List<ResultRow> = AppearanceVariationValuesTable.selectAll()
        .where { AppearanceVariationValuesTable.appearanceVariationId eq axisId }
        .orderBy(AppearanceVariationValuesTable.position).toList()

    private fun lockAxes(designSystemId: UUID, axes: List<ResultRow>) {
        check(lockDraftSubjects(designSystemId, "appearance-variation", axes.map { it[AppearanceVariationsTable.id] }))
    }

    /** Создаёт ось дизайн-системы с технической именем, уникальным в компоненте этой системы. */
    private fun newVariation(designSystemId: UUID, componentId: UUID, name: String): UUID {
        val taken = VariationsTable.selectAll().where {
            (VariationsTable.designSystemId eq designSystemId) and (VariationsTable.componentId eq componentId)
        }.map { it[VariationsTable.name].lowercase() }.toSet()
        val technical = if (name.lowercase() in taken) uniqueSuffix(name) else name
        return VariationWrites.create(designSystemId, componentId, technical, null)
    }

    /** Стиль дизайн-системы с таким именем, ещё не объявленный в этой оси, либо `null`. */
    private fun reusableStyle(designSystemId: UUID, variationId: UUID, name: String, declared: Set<UUID>): UUID? =
        ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.designSystemId eq designSystemId) and
                (ComponentStylesTable.variationId eq variationId) and
                (ComponentStylesTable.name eq name)
        }.singleOrNull()?.get(ComponentStylesTable.id)?.takeIf { it !in declared }

    private fun freeStyleName(designSystemId: UUID, variationId: UUID, name: String): String {
        val taken = ComponentStylesTable.selectAll().where {
            (ComponentStylesTable.designSystemId eq designSystemId) and
                (ComponentStylesTable.variationId eq variationId)
        }.map { it[ComponentStylesTable.name] }.toSet()
        return if (name in taken) uniqueSuffix(name) else name
    }

    private fun uniqueSuffix(name: String) = "$name-${UUID.randomUUID().toString().take(HEX_LENGTH)}"

    private fun lockValues(designSystemId: UUID, values: List<ResultRow>) {
        check(
            lockDraftSubjects(
                designSystemId,
                "appearance-variation-value",
                values.map { it[AppearanceVariationValuesTable.id] },
            ),
        )
    }

    private const val HEX_LENGTH = 8
}
