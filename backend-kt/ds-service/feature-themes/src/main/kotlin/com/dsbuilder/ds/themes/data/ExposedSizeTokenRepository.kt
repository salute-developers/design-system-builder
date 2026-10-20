package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenLock
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenRepository
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenTenant
import com.dsbuilder.ds.themes.application.sizetokens.StoredSizeToken
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import kotlinx.serialization.json.JsonNull
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.UUID

/** Exposed-хранилище токенов размеров: определения `tokens`, значения `token_values` и ревизии `tenants`. */
class ExposedSizeTokenRepository : SizeTokenRepository {
    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant? =
        TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where {
                val owner = ThemeDesignSystemsTable.projectId
                (TenantsTable.id eq tenantId) and ((owner eq projectId.value) or owner.isNull())
            }
            .limit(1)
            .singleOrNull()
            ?.let { row ->
                SizeTokenTenant(
                    designSystemId = row[TenantsTable.designSystemId],
                    editRevision = row[TenantsTable.editRevision],
                    owned = row[ThemeDesignSystemsTable.projectId] == projectId.value,
                )
            }

    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): SizeTokenLock {
        val designSystemId = TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where { (TenantsTable.id eq tenantId) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
            .limit(1)
            .singleOrNull()
            ?.get(TenantsTable.designSystemId)
            ?: return SizeTokenLock.NotFound
        // Темы блокируются в порядке `id`, как в операциях цветового токена: одновременные создания и удаления
        // в одной дизайн-системе не ждут друг друга по кругу.
        val locked = TenantsTable.selectAll()
            .where { if (allThemes) TenantsTable.designSystemId eq designSystemId else TenantsTable.id eq tenantId }
            .orderBy(TenantsTable.id to SortOrder.ASC)
            .forUpdate(ForUpdateOption.PostgreSQL.ForUpdate(null, TenantsTable))
            .map { row -> row[TenantsTable.id] to row[TenantsTable.editRevision] }
        val revision = locked.firstOrNull { (id, _) -> id == tenantId }?.second ?: return SizeTokenLock.NotFound
        return if (revision == editRevision) {
            SizeTokenLock.Locked(designSystemId, locked.map { (id, _) -> id }, revision)
        } else {
            SizeTokenLock.RevisionConflict(revision)
        }
    }

    override suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken> = withValues(
        tenantId,
        ThemeTokensTable.selectAll()
            .where {
                (ThemeTokensTable.designSystemId eq designSystemId) and (ThemeTokensTable.type inList SIZE_TYPES)
            }
            .toList(),
    )

    override suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken? = withValues(
        tenantId,
        ThemeTokensTable.selectAll()
            .where { (ThemeTokensTable.id eq tokenId) and (ThemeTokensTable.designSystemId eq designSystemId) }
            .limit(1)
            .toList(),
    ).singleOrNull()

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        if (names.isEmpty()) {
            emptySet()
        } else {
            ThemeTokensTable.selectAll()
                .where { (ThemeTokensTable.designSystemId eq designSystemId) and (ThemeTokensTable.name inList names) }
                .map { it[ThemeTokensTable.name] }
                .toSet()
        }

    override suspend fun insert(designSystemId: UUID, type: ThemeTokenType, names: List<String>): Map<String, UUID> =
        names.associateWith { name ->
            ThemeTokensTable.insertReturning(listOf(ThemeTokensTable.id)) {
                it[ThemeTokensTable.designSystemId] = designSystemId
                it[ThemeTokensTable.name] = name
                it[ThemeTokensTable.type] = type
                it[displayName] = SizeTokenNaming.displayName(name)
                it[description] = null
                it[groupId] = null
                it[position] = 0
            }.single()[ThemeTokensTable.id]
        }

    override suspend fun replaceValues(tenantIds: Collection<UUID>, tokenId: UUID, values: List<SizeWrittenValue>) {
        if (tenantIds.isEmpty()) return
        ThemeTokenValuesTable.deleteWhere {
            (ThemeTokenValuesTable.tenantId inList tenantIds) and (ThemeTokenValuesTable.tokenId eq tokenId)
        }
        tenantIds.forEach { tenant ->
            values.forEach { item ->
                ThemeTokenValuesTable.insert {
                    it[ThemeTokenValuesTable.tokenId] = tokenId
                    it[tenantId] = tenant
                    it[paletteId] = null
                    it[platform] = item.platform
                    it[mode] = null
                    it[value] = item.value
                    it[overridden] = item.overridden
                }
            }
        }
    }

    override suspend fun delete(tokenIds: Collection<UUID>) {
        if (tokenIds.isNotEmpty()) ThemeTokensTable.deleteWhere { ThemeTokensTable.id inList tokenIds }
    }

    override suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int> {
        if (tenantIds.isEmpty()) return emptyMap()
        val current = TenantsTable.selectAll()
            .where { TenantsTable.id inList tenantIds }
            .associate { row -> row[TenantsTable.id] to row[TenantsTable.editRevision] }
        return current.mapValues { (tenant, revision) ->
            (revision + 1).also { next ->
                TenantsTable.update({ TenantsTable.id eq tenant }) {
                    it[editRevision] = next
                    it[updatedAt] = Instant.now()
                }
            }
        }
    }

    /** Определения [rows] со значениями темы [tenantId]; значение без режима важнее значения режима. */
    private fun withValues(tenantId: UUID, rows: List<ResultRow>): List<StoredSizeToken> {
        if (rows.isEmpty()) return emptyList()
        val ids = rows.map { it[ThemeTokensTable.id] }
        val values = ThemeTokenValuesTable.selectAll()
            .where {
                (ThemeTokenValuesTable.tenantId eq tenantId) and
                    (ThemeTokenValuesTable.tokenId inList ids) and
                    ThemeTokenValuesTable.platform.isNotNull()
            }
            .sortedBy { it[ThemeTokenValuesTable.mode] != null }
            .groupBy { requireNotNull(it[ThemeTokenValuesTable.tokenId]) }
        return rows.map { row ->
            val id = row[ThemeTokensTable.id]
            StoredSizeToken(
                id = id,
                name = row[ThemeTokensTable.name],
                type = row[ThemeTokensTable.type],
                values = values[id].orEmpty()
                    .distinctBy { it[ThemeTokenValuesTable.platform] }
                    .associate { value ->
                        requireNotNull(value[ThemeTokenValuesTable.platform]) to SizeStoredValue(
                            value[ThemeTokenValuesTable.value] ?: JsonNull,
                            value[ThemeTokenValuesTable.overridden],
                        )
                    },
            )
        }
    }

    private companion object {
        val SIZE_TYPES = SizeTokenKind.entries.map(SizeTokenKind::type)
    }
}
