package com.dsbuilder.ds.themes.data

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
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNotNull
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.UUID

/** Exposed-хранилище цветовых токенов: определения `tokens`, значения `token_values` и ревизии `tenants`. */
class ExposedColorTokenRepository : ColorTokenRepository {
    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): ColorTokenLock {
        val designSystemId = TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where { (TenantsTable.id eq tenantId) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
            .limit(1)
            .singleOrNull()
            ?.get(TenantsTable.designSystemId)
            ?: return ColorTokenLock.NotFound
        // Темы блокируются в порядке `id`: одновременные создания и удаления в одной дизайн-системе не ждут друг
        // друга по кругу. Операции палитры и `PUT token-values` блокируют одну тему.
        val locked = TenantsTable.selectAll()
            .where { if (allThemes) TenantsTable.designSystemId eq designSystemId else TenantsTable.id eq tenantId }
            .orderBy(TenantsTable.id to SortOrder.ASC)
            .forUpdate(ForUpdateOption.PostgreSQL.ForUpdate(null, TenantsTable))
            .map { row -> row[TenantsTable.id] to row[TenantsTable.editRevision] }
        val revision = locked.firstOrNull { (id, _) -> id == tenantId }?.second ?: return ColorTokenLock.NotFound
        return if (revision == editRevision) {
            ColorTokenLock.Locked(designSystemId, locked.map { (id, _) -> id }, revision)
        } else {
            ColorTokenLock.RevisionConflict(revision)
        }
    }

    override suspend fun family(designSystemId: UUID, tokenId: UUID): ColorTokenLookup {
        val token = ThemeTokensTable.selectAll()
            .where { (ThemeTokensTable.id eq tokenId) and (ThemeTokensTable.designSystemId eq designSystemId) }
            .limit(1)
            .singleOrNull()
            ?: return ColorTokenLookup.Missing
        val family = token[ThemeTokensTable.type]?.let { ColorTokenFamily.of(it, token[ThemeTokensTable.name]) }
            ?: return ColorTokenLookup.OutsideFamily
        val members = ThemeTokensTable.selectAll()
            .where {
                (ThemeTokensTable.designSystemId eq designSystemId) and
                    (ThemeTokensTable.type eq family.type) and
                    (ThemeTokensTable.name like "${family.group}.%")
            }
            .filter { row -> family.memberOf(family.type, row[ThemeTokensTable.name]) }
            .associate { row -> row[ThemeTokensTable.name] to row[ThemeTokensTable.id] }
        return ColorTokenLookup.Found(StoredColorTokenFamily(family, members))
    }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        if (names.isEmpty()) {
            emptySet()
        } else {
            ThemeTokensTable.selectAll()
                .where { (ThemeTokensTable.designSystemId eq designSystemId) and (ThemeTokensTable.name inList names) }
                .map { it[ThemeTokensTable.name] }
                .toSet()
        }

    override suspend fun tokenTypes(tokenIds: Collection<UUID>): Map<UUID, ThemeTokenType> =
        if (tokenIds.isEmpty()) {
            emptyMap()
        } else {
            ThemeTokensTable.selectAll()
                .where { ThemeTokensTable.id inList tokenIds }
                .mapNotNull { row -> row[ThemeTokensTable.type]?.let { row[ThemeTokensTable.id] to it } }
                .toMap()
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
        // Отображаемое имя и описание — у члена `default`: им редактор подписывает токен целиком.
        val isDefault = name == family.defaultMember()
        ThemeTokensTable.insertReturning(listOf(ThemeTokensTable.id)) {
            it[ThemeTokensTable.designSystemId] = designSystemId
            it[ThemeTokensTable.name] = name
            it[type] = family.type
            it[ThemeTokensTable.displayName] = if (isDefault) displayName else null
            it[ThemeTokensTable.description] = if (isDefault) description else null
            it[ThemeTokensTable.groupId] = groupId
            it[ThemeTokensTable.position] = position
        }.single()[ThemeTokensTable.id]
    }

    override suspend fun placedIn(designSystemId: UUID, groupIds: Collection<UUID>): List<PlacedToken> =
        if (groupIds.isEmpty()) {
            emptyList()
        } else {
            ThemeTokensTable.selectAll()
                .where {
                    (ThemeTokensTable.designSystemId eq designSystemId) and (ThemeTokensTable.groupId inList groupIds)
                }
                .map(::placed)
        }

    override suspend fun placedById(tokenIds: Collection<UUID>): List<PlacedToken> =
        if (tokenIds.isEmpty()) {
            emptyList()
        } else {
            ThemeTokensTable.selectAll().where { ThemeTokensTable.id inList tokenIds }.map(::placed)
        }

    override suspend fun arrange(groupId: UUID?, slots: List<Collection<UUID>>) {
        slots.forEachIndexed { index, ids ->
            ThemeTokensTable.update({ ThemeTokensTable.id inList ids }) {
                it[ThemeTokensTable.groupId] = groupId
                it[position] = index
                it[updatedAt] = Instant.now()
            }
        }
    }

    override suspend fun rename(names: Map<UUID, String>) {
        names.forEach { (tokenId, name) ->
            ThemeTokensTable.update({ ThemeTokensTable.id eq tokenId }) {
                it[ThemeTokensTable.name] = name
                it[displayName] = ColorTokenNaming.displayName(name)
                it[updatedAt] = Instant.now()
            }
        }
    }

    private fun placed(row: ResultRow) = PlacedToken(
        id = row[ThemeTokensTable.id],
        name = row[ThemeTokensTable.name],
        type = row[ThemeTokensTable.type],
        groupId = row[ThemeTokensTable.groupId],
        position = row[ThemeTokensTable.position],
    )

    override suspend fun insertValues(tenantIds: Collection<UUID>, values: Map<UUID, List<ColorTokenValue>>) {
        tenantIds.forEach { tenant -> values.forEach { (token, items) -> insert(tenant, token, items) } }
    }

    override suspend fun replaceValues(tenantId: UUID, values: Map<UUID, List<ColorTokenValue>>) {
        ThemeTokenValuesTable.deleteWhere {
            (ThemeTokenValuesTable.tenantId eq tenantId) and
                (ThemeTokenValuesTable.tokenId inList values.keys) and
                ThemeTokenValuesTable.platform.isNotNull()
        }
        values.forEach { (token, items) -> insert(tenantId, token, items) }
    }

    override suspend fun deleteDefinitions(tokenIds: Collection<UUID>) {
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

    private fun insert(tenant: UUID, token: UUID, items: List<ColorTokenValue>) {
        items.forEach { item ->
            ThemeTokenValuesTable.insert {
                it[tokenId] = token
                it[tenantId] = tenant
                it[paletteId] = item.paletteId
                it[platform] = item.platform
                it[mode] = item.mode
                it[value] = item.value
            }
        }
    }
}
