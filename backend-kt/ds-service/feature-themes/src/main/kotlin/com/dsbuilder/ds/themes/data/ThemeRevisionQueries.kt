package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.ResolvedSubjectRows
import com.dsbuilder.ds.core.data.latestRevision
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.selectedVersionBoundary
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.Op
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.lessEq
import org.jetbrains.exposed.v1.core.lowerCase
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

internal fun currentTenantRows(
    projectId: ProjectId? = null,
    designSystemId: UUID? = null,
    tenantId: UUID? = null,
): List<ResultRow> = ResolvedSubjectRows(
    TenantsTable,
    TenantRevisionsTable,
    ThemeVersionBoundariesTable,
    TenantRevisionsTable.tenantId,
    ThemeDesignSystemsTable,
    designSystemId = designSystemId,
).read(
    run {
        var predicate: Op<Boolean> = TenantRevisionsTable.deleted eq false
        projectId?.let {
            predicate = predicate and
                ((ThemeDesignSystemsTable.projectId eq it.value) or ThemeDesignSystemsTable.projectId.isNull())
        }
        designSystemId?.let { predicate = predicate and (TenantsTable.designSystemId eq it) }
        tenantId?.let { predicate = predicate and (TenantsTable.id eq it) }
        predicate
    },
)

internal fun currentTenantQuery(
    projectId: ProjectId? = null,
    designSystemId: UUID? = null,
    tenantId: UUID? = null,
): org.jetbrains.exposed.v1.jdbc.Query = TenantsTable
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

internal fun currentThemeTokenRows(
    designSystemId: UUID? = null,
    tokenIds: Set<UUID>? = null,
    types: Set<ThemeTokenType> = emptySet(),
    names: Set<String> = emptySet(),
): List<ResultRow> {
    val reader = ResolvedSubjectRows(
        ThemeTokensTable,
        ThemeTokenRevisionsTable,
        ThemeVersionBoundariesTable,
        ThemeTokenRevisionsTable.tokenId,
        designSystemId = designSystemId,
    )
    val scope = (ThemeTokenRevisionsTable.deleted eq false).let { predicate ->
        designSystemId?.let { predicate and (ThemeTokensTable.designSystemId eq it) } ?: predicate
    }
    val selectedTokens = tokenIds?.takeIf { it.isNotEmpty() }?.toSortedSet()
    if (names.isEmpty() && (selectedTokens != null || types.isNotEmpty())) {
        reader.cached(scope)?.let { rows ->
            return rows.filter { row ->
                (selectedTokens == null || row[ThemeTokensTable.id] in selectedTokens) &&
                    (types.isEmpty() || row[ThemeTokenRevisionsTable.type] in types)
            }
        }
    }
    var predicate = scope
    selectedTokens?.let { predicate = predicate and (ThemeTokensTable.id inList it) }
    if (types.isNotEmpty()) predicate = predicate and (ThemeTokenRevisionsTable.type inList types)
    if (names.isNotEmpty()) predicate = predicate and (ThemeTokenRevisionsTable.name.lowerCase() inList names)
    return reader.read(predicate)
}

internal fun currentThemeTokenValueRows(
    designSystemId: UUID? = null,
    tenantIds: Set<UUID>? = null,
    tokenIds: Set<UUID>? = null,
    knownTokens: List<ResultRow>? = null,
    knownTenantIds: Set<UUID>? = null,
): List<ResultRow> {
    val reader = ResolvedSubjectRows(
        ThemeTokenValuesTable,
        ThemeTokenValueRevisionsTable,
        ThemeVersionBoundariesTable,
        ThemeTokenValueRevisionsTable.tokenValueId,
        designSystemId = designSystemId,
        columns = ThemeTokenValuesTable.columns + ThemeTokenValueRevisionsTable.columns + listOf(
            ThemeVersionBoundariesTable.id,
            ThemeVersionBoundariesTable.sequenceNumber,
        ),
    )
    val scope = run {
        var predicate: Op<Boolean> = ThemeTokenValueRevisionsTable.deleted eq false
        designSystemId?.let {
            predicate = predicate and (ThemeTokenValuesTable.designSystemId eq it) and
                (ThemeTokenValueRevisionsTable.designSystemId eq it)
        }
        tenantIds?.takeIf { it.isNotEmpty() }?.let {
            predicate = predicate and (ThemeTokenValuesTable.tenantId inList it)
        }
        predicate
    }
    val selectedTokens = tokenIds?.takeIf { it.isNotEmpty() }?.toSortedSet()
    val cached = selectedTokens?.let { reader.cached(scope) }
    val rows = cached?.filter { it[ThemeTokenValuesTable.tokenId] in requireNotNull(selectedTokens) }
        ?: reader.read(selectedTokens?.let { scope and (ThemeTokenValuesTable.tokenId inList it) } ?: scope)
    val activeTokenIds = (knownTokens ?: currentThemeTokenRows(designSystemId, tokenIds))
        .mapTo(hashSetOf()) { it[ThemeTokensTable.id] }
    val activeTenantIds = knownTenantIds ?: currentTenantRows(designSystemId = designSystemId)
        .mapTo(hashSetOf()) { it[TenantsTable.id] }
    return rows.filter { row ->
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
