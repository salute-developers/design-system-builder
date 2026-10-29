package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.domain.ProjectId
import java.util.UUID

/** Exposed-реализация операций редактора оформления; правила и записи находятся в объектах операций. */
class ExposedAppearanceEditorRepository(states: StateRepository) : AppearanceEditorRepository {
    private val values = AppearanceEditorValueOperations(states)

    override suspend fun model(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        versionId: UUID?,
    ): AppearanceEditorModel? = AppearanceEditorModelReader.read(projectId, systemAdmin, appearanceId, versionId)

    override suspend fun addAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.AxisCreate,
    ): EditorAxis? = AppearanceEditorAxisOperations.addAxis(projectId, systemAdmin, appearanceId, command)

    override suspend fun removeAxis(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval? =
        AppearanceEditorAxisOperations.removeAxis(projectId, systemAdmin, appearanceId, axisId, confirmCascade)

    override suspend fun reorderAxes(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisIds: List<UUID>,
    ): List<EditorAxis>? = AppearanceEditorAxisOperations.reorderAxes(projectId, systemAdmin, appearanceId, axisIds)

    override suspend fun addAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        command: AppearanceEditorRepository.AxisValueCreate,
    ): EditorAxisValue? =
        AppearanceEditorAxisOperations.addAxisValue(projectId, systemAdmin, appearanceId, axisId, command)

    override suspend fun removeAxisValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        valueId: UUID,
        confirmCascade: Boolean,
    ): EditorRemoval? =
        AppearanceEditorAxisOperations.removeAxisValue(projectId, systemAdmin, appearanceId, valueId, confirmCascade)

    override suspend fun reorderAxisValues(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        axisId: UUID,
        valueIds: List<UUID>,
    ): EditorAxis? =
        AppearanceEditorAxisOperations.reorderAxisValues(projectId, systemAdmin, appearanceId, axisId, valueIds)

    override suspend fun setPropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueSet,
    ): EditorPropertyValue? = values.setPropertyValue(projectId, systemAdmin, appearanceId, command)

    override suspend fun removePropertyValue(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueScope,
    ): Boolean = values.removePropertyValue(projectId, systemAdmin, appearanceId, command)

    override suspend fun reorderStates(
        projectId: ProjectId,
        systemAdmin: Boolean,
        appearanceId: UUID,
        command: AppearanceEditorRepository.StateOrder,
    ): List<EditorPropertyValue>? = values.reorderStates(projectId, systemAdmin, appearanceId, command)

    override suspend fun createAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: AppearanceEditorRepository.NewAppearance,
    ): Appearance? = AppearanceEditorConfigurationOperations.createAppearance(projectId, systemAdmin, command)

    override suspend fun duplicateAppearance(
        projectId: ProjectId,
        systemAdmin: Boolean,
        sourceId: UUID,
        name: String?,
    ): Appearance? = AppearanceEditorConfigurationOperations.duplicateAppearance(projectId, systemAdmin, sourceId, name)

    override suspend fun findAppearance(projectId: ProjectId, systemAdmin: Boolean, id: UUID): Appearance? =
        EditorSupport.readableAppearance(projectId, systemAdmin, id)?.let(AppearanceEditorModelReader::appearance)
}
