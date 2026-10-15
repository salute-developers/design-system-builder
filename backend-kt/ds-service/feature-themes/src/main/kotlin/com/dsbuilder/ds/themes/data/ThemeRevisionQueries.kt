package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

internal fun currentTenantRows(
    projectId: ProjectId? = null,
    designSystemId: UUID? = null,
    tenantId: UUID? = null,
): List<ResultRow> = TenantsTable
    .join(TenantRevisionsTable, JoinType.INNER, TenantsTable.id, TenantRevisionsTable.tenantId)
    .join(ThemeDesignSystemsTable, JoinType.INNER, TenantsTable.designSystemId, ThemeDesignSystemsTable.id)
    .join(
        ThemeVersionBoundariesTable,
        JoinType.INNER,
        TenantRevisionsTable.designSystemId,
        ThemeVersionBoundariesTable.designSystemId,
    )
    .selectAll()
    .where {
        var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
            (TenantRevisionsTable.versionSequenceNumber lessEq ThemeVersionBoundariesTable.sequenceNumber) and
            latestRevision("tenant_revisions", "tenant_id") and
            (TenantRevisionsTable.deleted eq false)
        projectId?.let {
            predicate = predicate and
                ((ThemeDesignSystemsTable.projectId eq it.value) or ThemeDesignSystemsTable.projectId.isNull())
        }
        designSystemId?.let { predicate = predicate and (TenantsTable.designSystemId eq it) }
        tenantId?.let { predicate = predicate and (TenantsTable.id eq it) }
        predicate
    }
    .toList()

internal fun currentThemeTokenRows(
    designSystemId: UUID? = null,
    tokenIds: Set<UUID>? = null,
): List<ResultRow> = ThemeTokensTable
    .join(ThemeTokenRevisionsTable, JoinType.INNER, ThemeTokensTable.id, ThemeTokenRevisionsTable.tokenId)
    .join(
        ThemeVersionBoundariesTable,
        JoinType.INNER,
        ThemeTokenRevisionsTable.designSystemId,
        ThemeVersionBoundariesTable.designSystemId,
    )
    .selectAll()
    .where {
        var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
            (ThemeTokenRevisionsTable.versionSequenceNumber lessEq ThemeVersionBoundariesTable.sequenceNumber) and
            latestRevision("token_revisions", "token_id") and
            (ThemeTokenRevisionsTable.deleted eq false)
        designSystemId?.let { predicate = predicate and (ThemeTokensTable.designSystemId eq it) }
        tokenIds?.takeIf { it.isNotEmpty() }?.let { predicate = predicate and (ThemeTokensTable.id inList it) }
        predicate
    }
    .toList()

internal fun currentThemeTokenValueRows(
    designSystemId: UUID? = null,
    tenantIds: Set<UUID>? = null,
    tokenIds: Set<UUID>? = null,
): List<ResultRow> = ThemeTokenValuesTable
    .join(
        ThemeTokenValueRevisionsTable,
        JoinType.INNER,
        ThemeTokenValuesTable.id,
        ThemeTokenValueRevisionsTable.tokenValueId,
    )
    .join(
        ThemeVersionBoundariesTable,
        JoinType.INNER,
        ThemeTokenValueRevisionsTable.designSystemId,
        ThemeVersionBoundariesTable.designSystemId,
    )
    .selectAll()
    .where {
        var predicate: Op<Boolean> = selectedVersionBoundary("design_system_versions") and
            (ThemeTokenValueRevisionsTable.versionSequenceNumber lessEq ThemeVersionBoundariesTable.sequenceNumber) and
            latestRevision("token_value_revisions", "token_value_id") and
            (ThemeTokenValueRevisionsTable.deleted eq false)
        designSystemId?.let { predicate = predicate and (ThemeTokenValuesTable.designSystemId eq it) }
        tenantIds?.takeIf { it.isNotEmpty() }?.let {
            predicate = predicate and (ThemeTokenValuesTable.tenantId inList it)
        }
        tokenIds?.takeIf { it.isNotEmpty() }?.let {
            predicate = predicate and (ThemeTokenValuesTable.tokenId inList it)
        }
        predicate
    }
    .toList()
    .let { rows ->
        val activeTokenIds = currentThemeTokenRows(designSystemId, tokenIds)
            .mapTo(hashSetOf()) { it[ThemeTokensTable.id] }
        val activeTenantIds = currentTenantRows(designSystemId = designSystemId)
            .mapTo(hashSetOf()) { it[TenantsTable.id] }
        rows.filter { row ->
            row[ThemeTokenValuesTable.tokenId] in activeTokenIds &&
                row[ThemeTokenValuesTable.tenantId] in activeTenantIds
        }
    }

internal fun themeDraft(designSystemId: UUID): ResultRow? {
    lockDesignSystemMutation(designSystemId)
    return ThemeVersionBoundariesTable.selectAll().where {
        (ThemeVersionBoundariesTable.designSystemId eq designSystemId) and
            (ThemeVersionBoundariesTable.status eq ThemeVersionBoundaryStatus.DRAFT)
    }.singleOrNull()
}
