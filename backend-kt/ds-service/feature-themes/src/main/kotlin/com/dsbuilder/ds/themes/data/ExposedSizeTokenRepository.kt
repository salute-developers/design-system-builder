package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.TokenReferenceCleaner
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.data.lockDraftSubjects
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenRepository
import com.dsbuilder.ds.themes.application.sizetokens.SizeTokenTenant
import com.dsbuilder.ds.themes.application.sizetokens.StoredSizeToken
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/**
 * Exposed-хранилище токенов размеров поверх предметных редакций: определения — `token_revisions`, значения —
 * `token_value_revisions` с признаком `overridden`, чтение — на границе транзакции. Значения размеров хранятся без
 * режима (`mode IS NULL`).
 */
class ExposedSizeTokenRepository(
    private val referenceCleaners: List<TokenReferenceCleaner> = emptyList(),
) : SizeTokenRepository {
    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant? =
        currentTenantRows(projectId, tenantId = tenantId).singleOrNull()?.let { row ->
            SizeTokenTenant(
                designSystemId = row[TenantsTable.designSystemId],
                owned = row[ThemeDesignSystemsTable.projectId] == projectId.value,
            )
        }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID): UUID? {
        val owner = currentTenantRows(projectId, tenantId = tenantId).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value }
            ?.get(TenantsTable.designSystemId)
            ?: return null
        lockDesignSystemMutation(owner)
        return owner
    }

    override suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken> =
        stored(currentThemeTokenRows(designSystemId), designSystemId, tenantId)

    override suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken? =
        stored(currentThemeTokenRows(designSystemId, setOf(tokenId)), designSystemId, tenantId).singleOrNull()

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> {
        if (names.isEmpty()) return emptySet()
        val normalized = names.associateBy { it.trim().lowercase() }
        return currentThemeTokenRows(designSystemId)
            .mapNotNull { normalized[it[ThemeTokenRevisionsTable.name].trim().lowercase()] }
            .toSet()
    }

    override suspend fun writeValues(
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        values: List<SizeWrittenValue>,
        baseRevisions: Map<ThemeTokenPlatform, Long>,
    ) {
        val entities = values.associate { it.platform to stableValue(designSystemId, tenantId, tokenId, it.platform) }
        check(lockDraftSubjects(designSystemId, TOKEN_VALUE, entities.values))
        // Повторное чтение после предметной блокировки: сравнение идёт с последней зафиксированной редакцией.
        val current = currentValues(designSystemId, setOf(tenantId), setOf(tokenId))
        values.sortedBy { entities.getValue(it.platform) }.forEach { value ->
            val entity = entities.getValue(value.platform)
            val before = current[entity]
            val paths = buildSet {
                if (before?.get(ThemeTokenValueRevisionsTable.value) != value.value) add("/value")
                if (before?.get(ThemeTokenValueRevisionsTable.overridden) != value.overridden) add("/overridden")
                if (before?.get(ThemeTokenValueRevisionsTable.paletteId) != null) add("/palette_id")
            }
            if (paths.isNotEmpty()) {
                writeThemeValueRevision(
                    entity = entity,
                    owner = designSystemId,
                    palette = null,
                    data = value.value,
                    paths = if (before == null) setOf("/value", "/overridden") else paths,
                    baseRevision = baseRevisions[value.platform],
                    overridden = value.overridden,
                )
            }
        }
    }

    override suspend fun create(
        designSystemId: UUID,
        type: ThemeTokenType,
        values: Map<String, List<SizeWrittenValue>>,
    ): Map<String, UUID> {
        val tenants = currentTenantRows(designSystemId = designSystemId).map { it[TenantsTable.id] }.sorted()
        // Новые адреса не имеют путей, поэтому базовая редакция запроса не даёт предупреждений, а метаданные изменения
        // перечисляют созданные определения и значения, как у создания цветового токена.
        return values.mapValues { (name, written) ->
            val entity = UUID.randomUUID()
            ThemeTokensTable.insert {
                it[id] = entity
                it[ThemeTokensTable.designSystemId] = designSystemId
                it[createdAt] = Instant.now()
            }
            writeThemeTokenRevision(
                entity,
                designSystemId,
                ThemeTokenPayload(
                    name = name,
                    type = type,
                    displayName = SizeTokenNaming.displayName(name),
                    description = null,
                    enabled = true,
                    groupId = null,
                    position = 0,
                ),
                setOf("/"),
            )
            tenants.forEach { tenant ->
                written.sortedBy { it.platform }.forEach { value ->
                    val valueId = stableValue(designSystemId, tenant, entity, value.platform)
                    writeThemeValueRevision(
                        entity = valueId,
                        owner = designSystemId,
                        palette = null,
                        data = value.value,
                        paths = setOf("/"),
                        overridden = value.overridden,
                    )
                }
            }
            entity
        }
    }

    override suspend fun delete(designSystemId: UUID, tokenIds: List<UUID>) {
        if (tokenIds.isEmpty()) return
        val ids = tokenIds.toSet()
        // Редакция удаляемого определения не является базовой редакцией каждого зависимого значения и ссылки
        // компонента; надгробия определений сравниваются с базовой редакцией запроса и попадают в метаданные.
        SubjectMutationPaths.withoutBaseComparison {
            referenceCleaners.forEach { it.clear(designSystemId, ids) }
            deleteThemeValues(ids)
        }
        tokenIds.sorted().forEach { token ->
            reviseThemeToken(token, setOf("/deleted")) { it.copy(deleted = true) }
        }
    }

    /**
     * Определения [rows] со значениями темы [tenantId] без режима. Значения читаются только у токенов размеров по
     * правилам имён: остальным разделу они не нужны.
     */
    private fun stored(rows: List<ResultRow>, designSystemId: UUID, tenantId: UUID): List<StoredSizeToken> {
        if (rows.isEmpty()) return emptyList()
        val ids = rows.filter { row ->
            SizeTokenNaming.kindOf(row[ThemeTokenRevisionsTable.type], row[ThemeTokenRevisionsTable.name]) != null
        }.mapTo(hashSetOf()) { it[ThemeTokensTable.id] }
        if (ids.isEmpty()) return rows.map { row -> definition(row, emptyMap()) }
        val values = currentValues(designSystemId, setOf(tenantId), ids).values
            .filter { it[ThemeTokenValuesTable.platform] != null }
            .groupBy { it[ThemeTokenValuesTable.tokenId] }
        return rows.map { row ->
            val platforms = values[row[ThemeTokensTable.id]].orEmpty().mapNotNull { value ->
                val data = value[ThemeTokenValueRevisionsTable.value] ?: return@mapNotNull null
                requireNotNull(value[ThemeTokenValuesTable.platform]) to
                    SizeStoredValue(data, value[ThemeTokenValueRevisionsTable.overridden])
            }.toMap()
            definition(row, platforms)
        }
    }

    private fun definition(row: ResultRow, values: Map<ThemeTokenPlatform, SizeStoredValue>) = StoredSizeToken(
        id = row[ThemeTokensTable.id],
        name = row[ThemeTokenRevisionsTable.name],
        type = row[ThemeTokenRevisionsTable.type],
        values = values,
    )

    /** Действующие значения без режима: идентификатор значения → строка значения с редакцией. */
    private fun currentValues(designSystemId: UUID, tenantIds: Set<UUID>, tokenIds: Set<UUID>): Map<UUID, ResultRow> =
        currentThemeTokenValueRows(designSystemId, tenantIds, tokenIds)
            .filter { it[ThemeTokenValuesTable.mode] == null }
            .associateBy { it[ThemeTokenValuesTable.id] }

    /** Устойчивая строка значения токена в теме и платформе без режима; создаётся, если её нет. */
    private fun stableValue(designSystemId: UUID, tenantId: UUID, tokenId: UUID, platform: ThemeTokenPlatform): UUID =
        ThemeTokenValuesTable.selectAll().where {
            (ThemeTokenValuesTable.tenantId eq tenantId) and (ThemeTokenValuesTable.tokenId eq tokenId) and
                (ThemeTokenValuesTable.platform eq platform) and ThemeTokenValuesTable.mode.isNull()
        }.singleOrNull()?.get(ThemeTokenValuesTable.id) ?: UUID.randomUUID().also { id ->
            ThemeTokenValuesTable.insert {
                it[ThemeTokenValuesTable.id] = id
                it[ThemeTokenValuesTable.designSystemId] = designSystemId
                it[ThemeTokenValuesTable.tokenId] = tokenId
                it[ThemeTokenValuesTable.tenantId] = tenantId
                it[ThemeTokenValuesTable.platform] = platform
                it[ThemeTokenValuesTable.mode] = null
                it[createdAt] = Instant.now()
            }
        }

    private companion object {
        const val TOKEN_VALUE = "token-value"
    }
}
