package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.ComponentPropertyReference
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyFamily
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/** Стили типографии в памяти: одна дизайн-система, темы проекта `project-1`. */
internal class FakeTypographyStyleRepository(
    val designSystemId: UUID,
    /** Тема → ревизия. */
    val revisions: MutableMap<UUID, Int>,
    /** Определения токенов: идентификатор → имя и тип. */
    val definitions: Map<UUID, Pair<String, ThemeTokenType>>,
    /** Тема → токен → платформа → значение. */
    val values: MutableMap<UUID, MutableMap<UUID, Map<ThemeTokenPlatform, JsonElement>>>,
    private val families: List<TypographyFamily>,
) : TypographyStyleRepository, TypographyUsageRepository {
    var references: List<ComponentPropertyReference> = emptyList()
    var writes = 0

    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): TypographyTenant? =
        revisions[tenantId]?.takeIf { projectId.value == PROJECT }?.let { TypographyTenant(designSystemId, it) }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID, editRevision: Int): TypographyStyleLock {
        val tenant = tenant(projectId, tenantId) ?: return TypographyStyleLock.NotFound
        return if (tenant.editRevision == editRevision) {
            TypographyStyleLock.Locked(designSystemId)
        } else {
            TypographyStyleLock.RevisionConflict(tenant.editRevision)
        }
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
        .map { (id, name) -> StoredTypographyToken(id, name, values[tenantId]?.get(id).orEmpty()) }

    override suspend fun families(designSystemId: UUID, tenantId: UUID): List<TypographyFamily> = families

    override suspend fun themeCount(designSystemId: UUID): Int = revisions.size

    override suspend fun writeValues(tenantId: UUID, values: Map<UUID, Map<ThemeTokenPlatform, JsonElement>>) {
        writes++
        values.forEach { (token, platforms) ->
            val stored = this.values.getOrPut(tenantId) { mutableMapOf() }
            stored[token] = stored[token].orEmpty() + platforms
        }
    }

    override suspend fun bumpRevision(tenantId: UUID): Int = revisions.getValue(tenantId).plus(1).also {
        revisions[tenantId] = it
    }

    override suspend fun references(designSystemId: UUID): List<ComponentPropertyReference> = references

    companion object {
        const val PROJECT = "project-1"
    }
}
