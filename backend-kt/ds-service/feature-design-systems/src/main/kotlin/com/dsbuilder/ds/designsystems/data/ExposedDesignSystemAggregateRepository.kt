package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.data.selectedVersionBelongsTo
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DesignSystemAggregateRepository
import com.dsbuilder.ds.designsystems.domain.DesignSystemAppearanceSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemComponentSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemStyleSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTenantSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemTokenSummary
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionStatus
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.castTo
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.select
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Exposed aggregate reads with ownership checked before dependent table access. */
class ExposedDesignSystemAggregateRepository : DesignSystemAggregateRepository {
    override suspend fun listComponents(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        query: String?,
    ): List<DesignSystemComponentSummary>? {
        if (!isAccessibleAtSelectedVersion(projectId, designSystemId)) return null
        var condition = AggregateDesignSystemComponentsTable.designSystemId eq designSystemId.value
        query?.takeIf(String::isNotBlank)?.let { raw ->
            val pattern = "%${raw.trim().lowercase()}%"
            condition = condition and (
                (AggregateComponentsTable.name.lowerCase() like pattern) or
                    (AggregateComponentsTable.description.lowerCase() like pattern)
                )
        }
        return AggregateDesignSystemComponentsTable.join(
            AggregateComponentsTable,
            JoinType.INNER,
            additionalConstraint = {
                AggregateDesignSystemComponentsTable.componentId eq AggregateComponentsTable.id
            },
        ).join(
            DesignSystemsTable,
            JoinType.INNER,
            additionalConstraint = {
                AggregateDesignSystemComponentsTable.designSystemId eq DesignSystemsTable.id
            },
        )
            .select(AggregateComponentsTable.columns)
            .where {
                condition and accessibleDesignSystem(DesignSystemsTable, projectId)
            }
            .map(::component)
    }

    override suspend fun listTokens(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        type: String?,
        query: String?,
    ): List<DesignSystemTokenSummary>? {
        if (!isAccessibleAtSelectedVersion(projectId, designSystemId)) return null
        var condition = AggregateTokensTable.designSystemId eq designSystemId.value
        type?.let { condition = condition and (AggregateTokensTable.type.castTo<String>(TextColumnType()) eq it) }
        query?.takeIf(String::isNotBlank)?.let { raw ->
            val pattern = "%${raw.trim().lowercase()}%"
            condition = condition and (
                (AggregateTokensTable.name.lowerCase() like pattern) or
                    (AggregateTokensTable.displayName.lowerCase() like pattern) or
                    (AggregateTokensTable.description.lowerCase() like pattern)
                )
        }
        val published = latestPublished(designSystemId)
        return AggregateTokensTable.join(
            DesignSystemsTable,
            JoinType.INNER,
            additionalConstraint = { AggregateTokensTable.designSystemId eq DesignSystemsTable.id },
        ).select(AggregateTokensTable.columns).where {
            condition and accessibleDesignSystem(DesignSystemsTable, projectId)
        }.map { row ->
            val publishedIn = published?.takeIf { (_, at) -> !row[AggregateTokensTable.createdAt].isAfter(at) }
            token(row, publishedIn?.first)
        }
    }

    /** Номер и время последней опубликованной версии дизайн-системы. */
    private fun latestPublished(designSystemId: DesignSystemId): Pair<String, Instant>? = VersionBoundariesTable
        .selectAll()
        .where {
            (VersionBoundariesTable.designSystemId eq designSystemId.value) and
                (VersionBoundariesTable.status eq DesignSystemVersionStatus.PUBLISHED)
        }
        .orderBy(VersionBoundariesTable.publishedAt to SortOrder.DESC)
        .limit(1)
        .singleOrNull()
        ?.let { row ->
            val version = row[VersionBoundariesTable.version]
            val publishedAt = row[VersionBoundariesTable.publishedAt]
            if (version != null && publishedAt != null) version to publishedAt else null
        }

    @Suppress("ReturnCount")
    override suspend fun listComponentStyles(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
        componentId: UUID,
    ): List<DesignSystemStyleSummary>? {
        if (!isAccessibleAtSelectedVersion(projectId, designSystemId)) return null
        val linked = AggregateDesignSystemComponentsTable.selectAll().where {
            (AggregateDesignSystemComponentsTable.designSystemId eq designSystemId.value) and
                (AggregateDesignSystemComponentsTable.componentId eq componentId)
        }.limit(1).any()
        if (!linked) return null
        val variationIds = AggregateVariationsTable.selectAll()
            .where {
                (AggregateVariationsTable.designSystemId eq designSystemId.value) and
                    (AggregateVariationsTable.componentId eq componentId)
            }
            .map { it[AggregateVariationsTable.id] }
        if (variationIds.isEmpty()) return emptyList()
        return AggregateStylesTable.join(
            DesignSystemsTable,
            JoinType.INNER,
            additionalConstraint = { AggregateStylesTable.designSystemId eq DesignSystemsTable.id },
        ).select(AggregateStylesTable.columns).where {
            (AggregateStylesTable.designSystemId eq designSystemId.value) and
                (AggregateStylesTable.variationId inList variationIds) and
                accessibleDesignSystem(DesignSystemsTable, projectId)
        }.map(::style)
    }

    override suspend fun listTenants(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemTenantSummary>? {
        if (!isAccessibleAtSelectedVersion(projectId, designSystemId)) return null
        return AggregateTenantsTable.join(
            DesignSystemsTable,
            JoinType.INNER,
            additionalConstraint = { AggregateTenantsTable.designSystemId eq DesignSystemsTable.id },
        ).select(AggregateTenantsTable.columns)
            .where {
                (AggregateTenantsTable.designSystemId eq designSystemId.value) and
                    accessibleDesignSystem(DesignSystemsTable, projectId)
            }
            .map(::tenant)
    }

    override suspend fun listAppearances(
        projectId: ProjectId,
        designSystemId: DesignSystemId,
    ): List<DesignSystemAppearanceSummary>? {
        if (!isAccessibleAtSelectedVersion(projectId, designSystemId)) return null
        return AggregateAppearancesTable.join(
            DesignSystemsTable,
            JoinType.INNER,
            additionalConstraint = { AggregateAppearancesTable.designSystemId eq DesignSystemsTable.id },
        ).select(AggregateAppearancesTable.columns)
            .where {
                (AggregateAppearancesTable.designSystemId eq designSystemId.value) and
                    accessibleDesignSystem(DesignSystemsTable, projectId)
            }
            .map(::appearance)
    }

    private fun isAccessible(projectId: ProjectId, id: DesignSystemId): Boolean = DesignSystemsTable
        .selectAll()
        .where {
            (DesignSystemsTable.id eq id.value) and
                ((DesignSystemsTable.projectId eq projectId.value) or DesignSystemsTable.projectId.isNull())
        }.limit(1).any()

    private fun isAccessibleAtSelectedVersion(projectId: ProjectId, id: DesignSystemId): Boolean =
        isAccessible(projectId, id) && selectedVersionBelongsTo(id.value)
}

private fun accessibleDesignSystem(table: DesignSystemsTable, projectId: ProjectId) =
    (table.projectId eq projectId.value) or table.projectId.isNull()

private fun component(row: ResultRow) = DesignSystemComponentSummary(
    row[AggregateComponentsTable.id],
    row[AggregateComponentsTable.name],
    row[AggregateComponentsTable.description],
    row[AggregateComponentsTable.createdAt],
    row[AggregateComponentsTable.updatedAt],
)

private fun token(row: ResultRow, publishedIn: String?) = DesignSystemTokenSummary(
    row[AggregateTokensTable.id],
    row[AggregateTokensTable.designSystemId],
    row[AggregateTokensTable.name],
    row[AggregateTokensTable.type],
    row[AggregateTokensTable.displayName],
    row[AggregateTokensTable.description],
    row[AggregateTokensTable.enabled],
    row[AggregateTokensTable.createdAt],
    row[AggregateTokensTable.updatedAt],
    row[AggregateTokensTable.groupId],
    row[AggregateTokensTable.position],
    publishedIn,
)

private fun style(row: ResultRow) = DesignSystemStyleSummary(
    row[AggregateStylesTable.id],
    row[AggregateStylesTable.designSystemId],
    row[AggregateStylesTable.variationId],
    row[AggregateStylesTable.name],
    row[AggregateStylesTable.description],
    row[AggregateStylesTable.createdAt],
    row[AggregateStylesTable.updatedAt],
)

private fun tenant(row: ResultRow) = DesignSystemTenantSummary(
    row[AggregateTenantsTable.id],
    row[AggregateTenantsTable.designSystemId],
    row[AggregateTenantsTable.name],
    row[AggregateTenantsTable.description],
    colorConfiguration(row[AggregateTenantsTable.colorConfig]),
    row[AggregateTenantsTable.createdAt],
    row[AggregateTenantsTable.updatedAt],
)

private fun appearance(row: ResultRow) = DesignSystemAppearanceSummary(
    row[AggregateAppearancesTable.id],
    row[AggregateAppearancesTable.designSystemId],
    row[AggregateAppearancesTable.componentId],
    row[AggregateAppearancesTable.name],
    row[AggregateAppearancesTable.createdAt],
    row[AggregateAppearancesTable.updatedAt],
)

private fun colorConfiguration(value: JsonElement): DesignSystemTenantSummary.ColorConfiguration {
    val objectValue = value.jsonObject
    return DesignSystemTenantSummary.ColorConfiguration(
        objectValue["grayTone"]?.jsonPrimitive?.content,
        objectValue["accentColor"]?.jsonPrimitive?.content,
        objectValue["light"]?.let(::saturation),
        objectValue["dark"]?.let(::saturation),
    )
}

private fun saturation(value: JsonElement): DesignSystemTenantSummary.ColorConfiguration.Saturation? {
    val objectValue = value.jsonObject
    val stroke = objectValue["strokeSaturation"]?.jsonPrimitive?.doubleOrNull ?: return null
    val fill = objectValue["fillSaturation"]?.jsonPrimitive?.doubleOrNull ?: return null
    return DesignSystemTenantSummary.ColorConfiguration.Saturation(stroke, fill)
}
