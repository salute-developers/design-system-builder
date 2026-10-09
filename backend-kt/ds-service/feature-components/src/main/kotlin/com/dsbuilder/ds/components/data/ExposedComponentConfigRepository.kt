package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ComponentConfigQuery
import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ExportComponentConfig
import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.selectAll

/** Component-config repository backed by the existing normalized db-service schema. */
class ExposedComponentConfigRepository internal constructor(
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
        val version = ComponentDesignSystemVersionsTable.selectAll().where {
            (ComponentDesignSystemVersionsTable.designSystemId eq query.designSystemId) and
                (ComponentDesignSystemVersionsTable.publicationStatus eq ComponentPublicationStatusDb.PUBLISHED)
        }.orderBy(
            ComponentDesignSystemVersionsTable.publishedAt to SortOrder.DESC,
            ComponentDesignSystemVersionsTable.version to SortOrder.DESC,
        ).limit(1).singleOrNull()?.get(ComponentDesignSystemVersionsTable.version)
            ?: return ComponentConfigRepository.ExportAttempt.Failed(
                "Design system '${designSystem[ComponentDesignSystemsTable.name]}' has no published version",
            )

        val componentFilter = normalized(query.components)
        val styleFilter = normalized(query.styles)
        val underived = linkedSetOf<String>()
        val entries = mutableListOf<ComponentConfigPackage.Entry>()
        val platform = requireNotNull(ComponentPlatformDb.fromWire(query.platform))
        for (appearance in appearances(query.designSystemId, platform)) {
            val componentName = camelToKebab(appearance.componentName)
            if (techToCamelCase(componentName) != appearance.componentName) {
                val restoredName = techToCamelCase(componentName)
                return ComponentConfigRepository.ExportAttempt.Failed(
                    "Component name '${appearance.componentName}' is not reversible: " +
                        "'$componentName' converts back to '$restoredName'",
                )
            }
            val styleName = appearance.name ?: "default"
            if (!matches(componentName, componentFilter) || !matches(styleName, styleFilter)) continue
            entries += ComponentConfigPackage.Entry(
                componentName,
                styleName,
                builder.build(appearance, exported = true, underived),
            )
        }
        return ComponentConfigRepository.ExportAttempt.Success(
            ComponentConfigPackage(
                ComponentConfigPackage.Meta(designSystem[ComponentDesignSystemsTable.name], version),
                entries.sortedWith(compareBy({ it.componentName }, { it.styleName })),
                underived.sorted(),
            ),
        )
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
                    (ComponentsTable.platform eq platform)
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

    private fun normalized(values: List<String>?): Set<String>? = values?.map(String::trim)?.filter(String::isNotEmpty)
        ?.map(String::lowercase)?.toSet()?.takeIf(Set<String>::isNotEmpty)

    private fun matches(value: String, filter: Set<String>?): Boolean = filter == null || value.lowercase() in filter
}
