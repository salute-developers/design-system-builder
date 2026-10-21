package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import com.dsbuilder.ds.themes.domain.typography.TypographyValueRevision
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Стили типографии в памяти: одна дизайн-система, темы проекта `project-1`, редакции значений. */
internal class FakeTypographyStyleRepository(
    val designSystemId: UUID,
    /** Темы дизайн-системы. */
    val tenants: Set<UUID>,
    /** Определения токенов: идентификатор → имя и тип. */
    val definitions: Map<UUID, Pair<String, ThemeTokenType>>,
    /** Тема → токен → платформа → значение. */
    val values: MutableMap<UUID, MutableMap<UUID, Map<ThemeTokenPlatform, JsonElement>>>,
    private val families: List<TypographyFamily>,
) : TypographyStyleRepository, TypographyUsageRepository {
    var references: List<ComponentPropertyReference> = emptyList()

    /** Технические редакции значений: идентификатор значения → редакция. */
    val revisions = mutableMapOf<UUID, Long>()

    /** Записанные редакции в порядке записи. */
    val written = mutableListOf<TypographyValueWrite>()
    var locks = 0
    private val valueIds = mutableMapOf<Triple<UUID, UUID, ThemeTokenPlatform>, UUID>()

    /** Устойчивый идентификатор значения темы [tenantId] токена [tokenId] на платформе [platform]. */
    fun valueId(tenantId: UUID, tokenId: UUID, platform: ThemeTokenPlatform): UUID =
        valueIds.getOrPut(Triple(tenantId, tokenId, platform)) { UUID.randomUUID() }

    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant? =
        tenantId.takeIf { it in tenants && projectId.value == PROJECT }?.let { TypographyTenant(designSystemId) }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID): TypographyStyleLock {
        tenant(projectId, tenantId) ?: return TypographyStyleLock.NotFound
        return TypographyStyleLock.Locked(designSystemId)
    }

    override suspend fun token(designSystemId: UUID, tokenId: UUID): TypographyTokenLookup =
        definitions[tokenId]?.let { (name, type) -> TypographyTokenLookup.Found(name, type) }
            ?: TypographyTokenLookup.Missing

    override suspend fun styles(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey?,
    ): List<StoredTypographyToken> = definitions
        .filterValues { (_, type) -> type == ThemeTokenType.TYPOGRAPHY }
        .mapNotNull { (id, definition) -> TypographyTokenName.parse(definition.first)?.let { id to it } }
        .filter { (_, name) -> style == null || name.style == style }
        .map { (id, name) ->
            val platforms = values[tenantId]?.get(id).orEmpty()
            StoredTypographyToken(
                id,
                name,
                platforms,
                platforms.keys.map { platform ->
                    val value = valueId(tenantId, id, platform)
                    TypographyValueRevision(platform, value, revisions[value] ?: 0)
                },
            )
        }

    override suspend fun lockStyle(
        designSystemId: UUID,
        tenantId: UUID,
        style: TypographyStyleKey,
    ): List<StoredTypographyToken> {
        locks++
        return styles(designSystemId, tenantId, style)
    }

    override suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily> = families

    override suspend fun themeCount(designSystemId: UUID): Int = tenants.size

    override suspend fun writeValues(designSystemId: UUID, values: List<TypographyValueWrite>) {
        values.forEach { write ->
            written += write
            val (tenant, token, platform) = valueIds.entries.single { it.value == write.valueId }.key
            val stored = this.values.getOrPut(tenant) { mutableMapOf() }
            stored[token] = stored[token].orEmpty() + (platform to write.value)
            revisions[write.valueId] = (revisions[write.valueId] ?: 0) + 1
        }
    }

    override suspend fun references(designSystemId: UUID): List<ComponentPropertyReference> = references

    companion object {
        const val PROJECT = "project-1"
    }
}
