package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.CoreCompatibilityIssue
import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.application.CoreProblemLocation
import com.dsbuilder.ds.core.application.CoreProblemValue
import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.data.ExposedCoreContextResolver
import com.dsbuilder.ds.core.data.coreSelectionRevision
import com.dsbuilder.ds.core.data.resolvedDraftRevision
import com.dsbuilder.ds.core.data.withCoreReadScope
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Проверяет сохранённые назначения до фильтрации экспортируемого состава. */
class ExposedCompatibilityChecker : CompatibilityChecker {
    override suspend fun check(projectId: ProjectId, designSystemId: UUID, versionId: UUID?): CoreCompatibilityReport =
        withCoreReadScope(designSystemId, versionId) { checkSelected(designSystemId, versionId) }

    private suspend fun checkSelected(
        designSystemId: UUID,
        versionId: UUID?,
    ): CoreCompatibilityReport {
        val catalog = CoreCompatibilityCatalog(designSystemId, versionId)
        val issues = mutableListOf<CoreCompatibilityIssue>()
        for (componentId in catalog.activeComponents - catalog.availableComponents) {
            issues += CoreCompatibilityIssue(
                "component:$componentId:CORE_COMPONENT_REMOVED", "CORE_COMPONENT_REMOVED", "blocking",
                CoreProblemLocation(
                    componentId, catalog.componentNames[componentId].orEmpty(),
                    catalog.componentPlatforms.getValue(componentId),
                    null, null, null, null, null, null,
                ),
                null, emptyList(),
            )
        }
        val appearances = catalog.appearances.values.filter {
            it[ComponentAppearancesTable.componentId] in catalog.activeComponents
        }
        val validator = CoreValueProblems(catalog)
        val candidates = AppearanceEditorModelReader.readForCompatibility(appearances, versionId).mapNotNull { model ->
            val problems = model.propertyValues.filter {
                validator.reasons(
                    model.appearance.componentId,
                    it,
                ).isNotEmpty()
            }
            model.copy(propertyValues = problems).takeIf { problems.isNotEmpty() }
        }
        for (model in AppearanceEditorModelReader.completeCompatibilityDetails(candidates, versionId)) {
            issues += appearanceIssues(model, catalog, versionId != null)
        }
        val context = context(designSystemId, versionId)
        val selectedPlatforms = context.coreReleases.map { it.ref.platform }.toSet()
        for (componentId in catalog.activeComponents) {
            val platform = catalog.componentPlatforms.getValue(componentId)
            if (platform !in selectedPlatforms) {
                issues.removeAll { it.location.componentId == componentId }
                issues += CoreCompatibilityIssue(
                    "component:$componentId:CORE_SELECTION_REQUIRED", "CORE_SELECTION_REQUIRED", "blocking",
                    CoreProblemLocation(
                        componentId, catalog.componentNames[componentId].orEmpty(), platform,
                        null, null, null, null, null, null,
                    ),
                    null, emptyList(),
                )
            }
        }
        return CoreCompatibilityReport(
            context,
            issues.sortedBy { it.issueId },
            issues.count { it.severity == "blocking" },
            issues.count { it.severity == "warning" },
            validatorVersion = 2,
        )
    }

    private fun appearanceIssues(
        model: AppearanceEditorModel,
        catalog: CoreCompatibilityCatalog,
        readOnly: Boolean,
    ): List<CoreCompatibilityIssue> = model.propertyValues.flatMap { value ->
        val reasons = CoreValueProblems(catalog).reasons(model.appearance.componentId, value)
        if (reasons.isEmpty()) return@flatMap emptyList()
        val adjustments = catalog.adjustments[value.id].orEmpty()
        val stored = CoreProblemValue(
            value.value,
            value.tokenId,
            value.tokenName,
            value.alpha,
            value.adjustment,
            value.reference?.targetAppearanceId,
            value.reference?.styleIds.orEmpty(),
            adjustments,
        )
        val actions = when {
            readOnly -> emptyList()
            adjustments.isNotEmpty() -> listOf("remove")
            else -> listOf("remove", "transfer")
        }
        val location = location(model, value, catalog)
        reasons.map { (code, severity) ->
            CoreCompatibilityIssue(
                "${value.kind.name.lowercase()}:${value.id}:$code",
                code,
                severity,
                location,
                stored,
                actions,
            )
        }
    }

    private fun location(
        model: AppearanceEditorModel,
        value: EditorPropertyValue,
        catalog: CoreCompatibilityCatalog,
    ): CoreProblemLocation = CoreProblemLocation(
        model.appearance.componentId, catalog.componentNames[model.appearance.componentId].orEmpty(),
        catalog.componentPlatforms.getValue(model.appearance.componentId),
        model.appearance.id, model.appearance.name, value.propertyId, catalog.propertyNames[value.propertyId],
        value.kind.name.lowercase(), value.id, value.styleIds,
        value.styleIds.map { id ->
            model.axes.firstNotNullOfOrNull { axis ->
                axis.values.find { it.styleId == id }?.let { "${axis.name}=${it.name}" }
            } ?: id.toString()
        },
        catalog.sets[value.stateSetId].orEmpty().map { catalog.stateNames[it] ?: it.toString() },
        value.revision,
    )

    private suspend fun context(designSystemId: UUID, versionId: UUID?): ModelReadContext {
        val boundary = ComponentVersionBoundariesTable.selectAll().where {
            (ComponentVersionBoundariesTable.designSystemId eq designSystemId) and
                if (versionId == null) {
                    (ComponentVersionBoundariesTable.status eq ComponentVersionBoundaryStatus.DRAFT)
                } else {
                    (ComponentVersionBoundariesTable.id eq versionId)
                }
        }.single()
        val id = boundary[ComponentVersionBoundariesTable.id]
        return ModelReadContext(
            designSystemId,
            versionId = versionId,
            draftId = id.takeIf { versionId == null },
            draftRevision = if (versionId == null) resolvedDraftRevision(id) else null,
            coreReleases = ExposedCoreContextResolver().resolve(versionId),
            coreSelectionRevision = if (versionId == null) coreSelectionRevision(id) else null,
        )
    }
}
