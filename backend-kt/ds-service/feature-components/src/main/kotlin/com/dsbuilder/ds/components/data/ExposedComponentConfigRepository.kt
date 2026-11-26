package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentConfigQuery
import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ExportComponentConfig
import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.data.selectedVersionId
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.inSubQuery
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Component-config repository backed by the existing normalized db-service schema. */
class ExposedComponentConfigRepository internal constructor(
    private val checker: CompatibilityChecker,
    private val builder: ComponentConfigBuilder = ComponentConfigBuilder(),
    private val importer: ComponentConfigImporter = ComponentConfigImporter(),
) : ComponentConfigRepository {
    @Suppress("ReturnCount")
    override suspend fun get(
        projectId: ProjectId,
        systemAdmin: Boolean,
        query: ComponentConfigQuery,
    ): ComponentConfig? {
        val designSystem = ComponentDesignSystemsTable.selectAll()
            .where { ComponentDesignSystemsTable.name eq query.designSystemName }
            .singleOrNull() ?: return null
        val designSystemId = designSystem[ComponentDesignSystemsTable.id]
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, designSystemId)) return null
        val platform = requireNotNull(ComponentPlatformDb.fromWire(query.platform))
        val appearance = appearances(designSystemId, platform).firstOrNull {
            it.componentName == query.componentName && it.name == query.appearanceName
        } ?: return null
        return builder.build(appearance, exported = false, linkedSetOf())
    }

    @Suppress("ReturnCount")
    override suspend fun export(
        projectId: ProjectId,
        systemAdmin: Boolean,
        query: ExportComponentConfig,
    ): ComponentConfigRepository.ExportAttempt {
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, query.designSystemId)) {
            return ComponentConfigRepository.ExportAttempt.NotFound
        }
        val designSystem = ComponentDesignSystemsTable.selectAll()
            .where { ComponentDesignSystemsTable.id eq query.designSystemId }.single()
        val version = componentExportVersion(query.designSystemId)
            ?: return ComponentConfigRepository.ExportAttempt.NotFound

        val componentFilter = normalized(query.components)
        val styleFilter = normalized(query.styles)
        val platform = requireNotNull(ComponentPlatformDb.fromWire(query.platform))
        val compatibility = checker.check(projectId, query.designSystemId, selectedVersionId())
            .forExport(query.designSystemId, platform.wireValue, componentFilter, styleFilter)
        if (compatibility.blockingCount > 0) return ComponentConfigRepository.ExportAttempt.Conflict(compatibility)
        val underived = linkedSetOf<String>()
        val entries = mutableListOf<ComponentConfigPackage.Entry>()
        for (appearance in appearances(query.designSystemId, platform)) {
            val componentName = camelToKebab(appearance.componentName)
            val styleName = appearance.name ?: "default"
            if (!matches(componentName, componentFilter) || !matches(styleName, styleFilter)) continue
            if (techToCamelCase(componentName) != appearance.componentName) {
                val restoredName = techToCamelCase(componentName)
                return ComponentConfigRepository.ExportAttempt.Failed(
                    "Component name '${appearance.componentName}' is not reversible: " +
                        "'$componentName' converts back to '$restoredName'",
                )
            }
            entries += ComponentConfigPackage.Entry(
                componentName,
                styleName,
                builder.build(
                    appearance,
                    exported = true,
                    underived,
                    withPlatformOffsets = true,
                    editorIds = query.editorIds,
                ),
            )
        }
        return ComponentConfigRepository.ExportAttempt.Success(
            ComponentConfigPackage(
                ComponentConfigPackage.Meta(
                    designSystem[ComponentDesignSystemsTable.name],
                    version,
                    compatibility.context.coreReleases.filter {
                        it.ref.platform == platform.wireValue
                    },
                ),
                entries.sortedWith(compareBy({ it.componentName }, { it.styleName })),
                underived.sorted(),
            ),
        )
    }

    private fun CoreCompatibilityReport.forExport(
        designSystemId: UUID,
        platform: String,
        components: Set<String>?,
        styles: Set<String>?,
    ): CoreCompatibilityReport {
        val platformIssues = items.filter { issue ->
            val location = issue.location
            val matchesComponent = issue.code == "CORE_SELECTION_REQUIRED" ||
                matches(camelToKebab(location.componentName), components)
            location.platform == platform && matchesComponent
        }
        val matching = if (styles == null) {
            platformIssues
        } else {
            val wholeComponents = platformIssues.filter {
                it.location.appearanceId == null && it.code != "CORE_SELECTION_REQUIRED"
            }.map { it.location.componentId }.toSet()
            val styledComponents = componentsWithStyles(designSystemId, wholeComponents, styles)
            platformIssues.filter { issue ->
                val location = issue.location
                when {
                    issue.code == "CORE_SELECTION_REQUIRED" -> true
                    location.appearanceId == null -> location.componentId in styledComponents
                    else -> matches(location.appearanceName ?: "default", styles)
                }
            }
        }
        return copy(
            items = matching,
            blockingCount = matching.count { it.severity == "blocking" },
            warningCount = matching.count { it.severity == "warning" },
        )
    }

    private fun componentsWithStyles(designSystemId: UUID, components: Set<UUID>, styles: Set<String>): Set<UUID> {
        if (components.isEmpty()) return emptySet()
        // Оформления удалённого из Core компонента видны по сохранённым ревизиям без JOIN с выбранным каталогом.
        return ComponentAppearancesTable.select(ComponentAppearancesTable.componentId, ComponentAppearancesTable.name)
            .where {
                (ComponentAppearancesTable.designSystemId eq designSystemId) and
                    (ComponentAppearancesTable.componentId inList components)
            }
            .filter { matches(it[ComponentAppearancesTable.name] ?: "default", styles) }
            .mapTo(mutableSetOf()) { it[ComponentAppearancesTable.componentId] }
    }

    override suspend fun import(
        projectId: ProjectId,
        systemAdmin: Boolean,
        command: ImportComponentConfig,
    ): ComponentConfigRepository.ImportAttempt {
        if (!ComponentOwnership.canReadDesignSystem(projectId, systemAdmin, command.designSystemId)) {
            return ComponentConfigRepository.ImportAttempt.NotFound
        }
        if (!ComponentOwnership.canWriteDesignSystem(projectId, systemAdmin, command.designSystemId)) {
            return ComponentConfigRepository.ImportAttempt.GlobalForbidden
        }
        return importer.import(command)
    }

    private fun appearances(
        designSystemId: java.util.UUID,
        platform: ComponentPlatformDb,
    ): List<ConfigAppearance> {
        val query = ComponentAppearancesTable.innerJoin(ComponentsTable).selectAll()
            .where {
                (ComponentAppearancesTable.designSystemId eq designSystemId) and
                    (ComponentsTable.platform eq platform) and
                    (
                        ComponentAppearancesTable.componentId inSubQuery
                            DesignSystemComponentsTable.select(DesignSystemComponentsTable.componentId)
                                .where { DesignSystemComponentsTable.designSystemId eq designSystemId }
                        )
            }
        return query.map {
            ConfigAppearance(
                it[ComponentAppearancesTable.id],
                it[ComponentAppearancesTable.designSystemId],
                it[ComponentAppearancesTable.componentId],
                it[ComponentsTable.name],
                it[ComponentAppearancesTable.name],
            )
        }
    }

    private fun normalized(values: List<String>?): Set<String>? = values.orEmpty().asSequence()
        .map(String::trim)
        .filter(String::isNotEmpty)
        .map(String::lowercase)
        .toSet()
        .takeIf(Set<String>::isNotEmpty)

    private fun matches(value: String, filter: Set<String>?): Boolean = filter == null || value.lowercase() in filter
}
