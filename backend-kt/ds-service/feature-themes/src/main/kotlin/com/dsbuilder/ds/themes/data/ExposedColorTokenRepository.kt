package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.TokenReferenceCleaner
import com.dsbuilder.ds.core.data.SubjectMutationPaths
import com.dsbuilder.ds.core.data.lockDesignSystemMutation
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLock
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLookup
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenValue
import com.dsbuilder.ds.themes.application.colortokens.PlacedToken
import com.dsbuilder.ds.themes.application.colortokens.StoredColorTokenFamily
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenNaming
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.time.Instant
import java.util.UUID

/** Цветовые операции над предметными редакциями без общей блокировки всех тем. */
class ExposedColorTokenRepository(
    private val referenceCleaners: List<TokenReferenceCleaner> = emptyList(),
) : ColorTokenRepository {
    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): ColorTokenLock {
        val tenant = currentTenantRows(projectId, tenantId = tenantId).singleOrNull()
            ?.takeIf { it[ThemeDesignSystemsTable.projectId] == projectId.value } ?: return ColorTokenLock.NotFound
        val owner = tenant[TenantsTable.designSystemId]
        lockDesignSystemMutation(owner)
        val tenants = if (allThemes) {
            currentTenantRows(
                projectId,
                owner,
            ).map { it[TenantsTable.id] }
        } else {
            listOf(tenantId)
        }
        // Совместимое поле DTO больше не участвует в конкурентной записи.
        return ColorTokenLock.Locked(owner, tenants, 0)
    }

    override suspend fun family(designSystemId: UUID, tokenId: UUID): ColorTokenLookup {
        val rows = currentThemeTokenRows(designSystemId)
        val token = rows.firstOrNull { it[ThemeTokensTable.id] == tokenId } ?: return ColorTokenLookup.Missing
        val family = token[ThemeTokenRevisionsTable.type]?.let {
            ColorTokenFamily.of(it, token[ThemeTokenRevisionsTable.name])
        } ?: return ColorTokenLookup.OutsideFamily
        val members = rows.filter { row ->
            row[ThemeTokenRevisionsTable.type] == family.type &&
                family.memberOf(family.type, row[ThemeTokenRevisionsTable.name])
        }.associate { it[ThemeTokenRevisionsTable.name] to it[ThemeTokensTable.id] }
        return ColorTokenLookup.Found(StoredColorTokenFamily(family, members))
    }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        if (names.isEmpty()) {
            emptySet()
        } else {
            currentThemeTokenRows(designSystemId)
                .map { it[ThemeTokenRevisionsTable.name] }.filter { it in names }.toSet()
        }

    override suspend fun tokenTypes(tokenIds: Collection<UUID>): Map<UUID, ThemeTokenType> =
        if (tokenIds.isEmpty()) {
            emptyMap()
        } else {
            currentThemeTokenRows(tokenIds = tokenIds.toSet())
                .mapNotNull { row ->
                    row[ThemeTokenRevisionsTable.type]?.let { row[ThemeTokensTable.id] to it }
                }.toMap()
        }

    override suspend fun insertDefinitions(
        designSystemId: UUID,
        family: ColorTokenFamily,
        names: List<String>,
        displayName: String?,
        description: String?,
        groupId: UUID?,
        position: Int,
    ): Map<String, UUID> = names.associateWith { name ->
        val entity = UUID.randomUUID()
        ThemeTokensTable.insert {
            it[id] = entity
            it[ThemeTokensTable.designSystemId] = designSystemId
            it[createdAt] = Instant.now()
        }
        val isDefault = name == family.defaultMember()
        writeThemeTokenRevision(
            entity,
            designSystemId,
            ThemeTokenPayload(
                name,
                family.type,
                displayName.takeIf { isDefault },
                description.takeIf { isDefault },
                true,
                groupId,
                position,
            ),
            setOf("/"),
        )
        entity
    }

    override suspend fun placedIn(designSystemId: UUID, groupIds: Collection<UUID>): List<PlacedToken> =
        if (groupIds.isEmpty()) {
            emptyList()
        } else {
            currentThemeTokenRows(designSystemId)
                .filter { it[ThemeTokenRevisionsTable.groupId] in groupIds }.map(::placed)
        }

    override suspend fun placedById(tokenIds: Collection<UUID>): List<PlacedToken> =
        if (tokenIds.isEmpty()) emptyList() else currentThemeTokenRows(tokenIds = tokenIds.toSet()).map(::placed)

    override suspend fun arrange(groupId: UUID?, slots: List<Collection<UUID>>) {
        slots.forEachIndexed { index, ids ->
            ids.sorted().forEach { token ->
                reviseThemeToken(
                    token,
                    setOf("/group_id", "/position"),
                ) { it.copy(groupId = groupId, position = index) }
            }
        }
    }

    override suspend fun rename(names: Map<UUID, String>) {
        names.toSortedMap().forEach { (token, name) ->
            reviseThemeToken(token, setOf("/name", "/display_name")) {
                it.copy(name = name, displayName = ColorTokenNaming.displayName(name))
            }
        }
    }

    private fun placed(row: ResultRow) = PlacedToken(
        row[ThemeTokensTable.id],
        row[ThemeTokenRevisionsTable.name],
        row[ThemeTokenRevisionsTable.type],
        row[ThemeTokenRevisionsTable.groupId],
        row[ThemeTokenRevisionsTable.position],
    )

    override suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>) {
        tenantIds.sorted().forEach { tenant ->
            values.toSortedMap().forEach { (token, items) -> saveValues(tenant, token, items) }
        }
    }

    override suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>) {
        values.toSortedMap().forEach { (token, items) -> saveValues(tenantId, token, items) }
    }

    override suspend fun deleteDefinitions(tokenIds: Collection<UUID>, primaryTokenId: UUID?) {
        if (tokenIds.isEmpty()) return
        // Редакция удаляемой группы/определения не является базовой редакцией каждого зависимого значения.
        SubjectMutationPaths.withoutBaseComparison {
            currentThemeTokenRows(tokenIds = tokenIds.toSet()).groupBy { it[ThemeTokensTable.designSystemId] }
                .forEach { (owner, rows) ->
                    val ids = rows.mapTo(hashSetOf()) { row -> row[ThemeTokensTable.id] }
                    if (owner != null) referenceCleaners.forEach { it.clear(owner, ids) }
                }
            TenantPaletteTokenGroupsTable.selectAll().where { TenantPaletteTokenGroupsTable.tokenId inList tokenIds }
                .sortedBy { it[TenantPaletteTokenGroupsTable.id] }.forEach { row ->
                    PaletteAssignmentRevisions.replace(
                        row[TenantPaletteTokenGroupsTable.id],
                        row[TenantPaletteTokenGroupsTable.designSystemId],
                        setOf("/deleted"),
                        removed = true,
                    )
                }
            deleteThemeValues(tokenIds.toSet())
            tokenIds.sorted().forEach { token ->
                if (token != primaryTokenId) reviseThemeToken(token, setOf("/deleted")) { it.copy(deleted = true) }
            }
        }
        if (primaryTokenId != null) reviseThemeToken(primaryTokenId, setOf("/deleted")) { it.copy(deleted = true) }
    }

    override suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int> = tenantIds.associateWith { 0 }

    private fun saveValues(tenant: UUID, token: UUID, items: List<ColorTokenValue>) {
        val owner = requireNotNull(currentTenantRows(tenantId = tenant).singleOrNull())[TenantsTable.designSystemId]
        val existing = currentThemeTokenValueRows(owner, setOf(tenant), setOf(token))
        // Отсутствующая платформа не является командой её удаления или перезаписи.
        items.forEach { item ->
            val stable = ThemeTokenValuesTable.selectAll().where {
                (ThemeTokenValuesTable.tenantId eq tenant) and (ThemeTokenValuesTable.tokenId eq token) and
                    (ThemeTokenValuesTable.platform eq item.platform) and
                    (item.mode?.let { ThemeTokenValuesTable.mode eq it } ?: ThemeTokenValuesTable.mode.isNull())
            }.singleOrNull()
            val entity = stable?.get(ThemeTokenValuesTable.id) ?: UUID.randomUUID().also { id ->
                ThemeTokenValuesTable.insert {
                    it[ThemeTokenValuesTable.id] = id
                    it[designSystemId] = owner
                    it[tokenId] = token
                    it[tenantId] = tenant
                    it[platform] = item.platform
                    it[mode] = item.mode
                    it[createdAt] = Instant.now()
                }
            }
            val before = existing.firstOrNull { it[ThemeTokenValuesTable.id] == entity }
            if (before == null || before[ThemeTokenValueRevisionsTable.paletteId] != item.paletteId ||
                before[ThemeTokenValueRevisionsTable.value] != item.value
            ) {
                writeThemeValueRevision(entity, owner, item.paletteId, item.value, baseRevision = item.baseRevision)
            }
        }
    }
}
