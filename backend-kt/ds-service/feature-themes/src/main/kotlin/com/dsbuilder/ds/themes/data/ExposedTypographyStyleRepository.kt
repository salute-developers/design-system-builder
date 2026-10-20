package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.typography.TypographyStyleLock
import com.dsbuilder.ds.themes.application.typography.TypographyStyleRepository
import com.dsbuilder.ds.themes.application.typography.TypographyTenant
import com.dsbuilder.ds.themes.application.typography.TypographyTokenLookup
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyPlatformValues
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.like
import org.jetbrains.exposed.v1.core.vendors.ForUpdateOption
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.UUID

/** Exposed-хранилище стилей типографии: токены `tokens`, значения `token_values` и ревизия `tenants`. */
class ExposedTypographyStyleRepository : TypographyStyleRepository {
    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant? =
        TenantsTable.innerJoin(ThemeDesignSystemsTable)
            .selectAll()
            .where { (TenantsTable.id eq tenantId) and (ThemeDesignSystemsTable.projectId eq projectId.value) }
            .limit(1)
            .singleOrNull()
            ?.let { row -> TypographyTenant(row[TenantsTable.designSystemId], row[TenantsTable.editRevision]) }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TypographyStyleLock {
        val tenant = tenant(projectId, tenantId) ?: return TypographyStyleLock.NotFound
        val revision = TenantsTable.selectAll()
            .where { TenantsTable.id eq tenantId }
            .forUpdate(ForUpdateOption.PostgreSQL.ForUpdate(null, TenantsTable))
            .singleOrNull()
            ?.get(TenantsTable.editRevision)
            ?: return TypographyStyleLock.NotFound
        return if (revision == editRevision) {
            TypographyStyleLock.Locked(tenant.designSystemId)
        } else {
            TypographyStyleLock.RevisionConflict(revision)
        }
    }

    override suspend fun token(designSystemId: UUID, tokenId: UUID): TypographyTokenLookup =
        ThemeTokensTable.selectAll()
            .where { (ThemeTokensTable.id eq tokenId) and (ThemeTokensTable.designSystemId eq designSystemId) }
            .limit(1)
            .singleOrNull()
            ?.let { row -> TypographyTokenLookup.Found(row[ThemeTokensTable.name], row[ThemeTokensTable.type]) }
            ?: TypographyTokenLookup.Missing

    override suspend fun styles(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey?,
    ): List<StoredTypographyToken> {
        val tokens = ThemeTokensTable.selectAll()
            .where {
                val scope = (ThemeTokensTable.designSystemId eq designSystemId) and
                    (ThemeTokensTable.type eq ThemeTokenType.TYPOGRAPHY)
                if (style == null) scope else scope and (ThemeTokensTable.name like "screen-%.$style.%")
            }
            .mapNotNull { row ->
                TypographyTokenName.parse(row[ThemeTokensTable.name])
                    ?.takeIf { name -> style == null || name.style == style }
                    ?.let { name -> row[ThemeTokensTable.id] to name }
            }
        val values = values(tenantId, tokens.map { it.first })
        return tokens.map { (id, name) -> StoredTypographyToken(id, name, values[id].orEmpty()) }
    }

    override suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily> {
        val tokens = ThemeTokensTable.selectAll()
            .where {
                (ThemeTokensTable.designSystemId eq designSystemId) and
                    (ThemeTokensTable.type eq ThemeTokenType.FONT_FAMILY)
            }
            .associate { row -> row[ThemeTokensTable.id] to row[ThemeTokensTable.name] }
        val values = values(tenantId, tokens.keys)
        return tokens.map { (id, name) ->
            val platforms = values[id].orEmpty()
            val fontName = sequenceOf(ThemeTokenPlatform.WEB, ThemeTokenPlatform.ANDROID, ThemeTokenPlatform.IOS)
                .mapNotNull { platform -> platforms[platform] }
                .mapNotNull { value -> TypographyPlatformValues.objectOf(value)["name"] as? JsonPrimitive }
                .mapNotNull { it.contentOrNull }
                .firstOrNull()
                .orEmpty()
            TypographyFamily(name.removePrefix(TypographyPlatformValues.FONT_FAMILY_PREFIX), fontName)
        }.sortedBy { FAMILY_ORDER.indexOf(it.name).takeIf { index -> index >= 0 } ?: FAMILY_ORDER.size }
    }

    override suspend fun themeCount(designSystemId: UUID): Int =
        TenantsTable.selectAll().where { TenantsTable.designSystemId eq designSystemId }.count().toInt()

    override suspend fun writeValues(tenantId: UUID, values: Map<UUID, Map<ThemeTokenPlatform, JsonElement>>) {
        if (values.isEmpty()) return
        val existing = ThemeTokenValuesTable.selectAll()
            .where {
                (ThemeTokenValuesTable.tenantId eq tenantId) and
                    (ThemeTokenValuesTable.tokenId inList values.keys) and
                    ThemeTokenValuesTable.mode.isNull()
            }
            .mapNotNull { row ->
                row[ThemeTokenValuesTable.platform]?.let { platform ->
                    (row[ThemeTokenValuesTable.tokenId] to platform) to row[ThemeTokenValuesTable.id]
                }
            }
            .toMap()
        val now = Instant.now()
        values.forEach { (token, platforms) ->
            platforms.forEach { (platform, value) ->
                val id = existing[token to platform]
                if (id != null) {
                    ThemeTokenValuesTable.update({ ThemeTokenValuesTable.id eq id }) {
                        it[ThemeTokenValuesTable.value] = value
                        it[updatedAt] = now
                    }
                } else {
                    ThemeTokenValuesTable.insert {
                        it[tokenId] = token
                        it[ThemeTokenValuesTable.tenantId] = tenantId
                        it[ThemeTokenValuesTable.platform] = platform
                        it[ThemeTokenValuesTable.value] = value
                    }
                }
            }
        }
    }

    override suspend fun bumpRevision(tenantId: UUID): Int {
        val next = TenantsTable.selectAll()
            .where { TenantsTable.id eq tenantId }
            .single()[TenantsTable.editRevision] + 1
        TenantsTable.update({ TenantsTable.id eq tenantId }) {
            it[editRevision] = next
            it[updatedAt] = Instant.now()
        }
        return next
    }

    /** Значения платформ без режима — так хранятся типографика и семейства: токен → платформа → значение. */
    private fun values(tenantId: UUID, tokenIds: Collection<UUID>): Map<UUID, Map<ThemeTokenPlatform, JsonElement>> =
        if (tokenIds.isEmpty()) {
            emptyMap()
        } else {
            ThemeTokenValuesTable.selectAll()
                .where {
                    (ThemeTokenValuesTable.tenantId eq tenantId) and
                        (ThemeTokenValuesTable.tokenId inList tokenIds) and
                        ThemeTokenValuesTable.mode.isNull()
                }
                .mapNotNull { row ->
                    val token = row[ThemeTokenValuesTable.tokenId] ?: return@mapNotNull null
                    val platform = row[ThemeTokenValuesTable.platform] ?: return@mapNotNull null
                    val value = row[ThemeTokenValuesTable.value] ?: return@mapNotNull null
                    Triple(token, platform, value)
                }
                .groupBy({ it.first }, { it.second to it.third })
                .mapValues { (_, items) -> items.toMap() }
        }

    private companion object {
        val FAMILY_ORDER = listOf("display", "header", "body", "text")
    }
}
