package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import java.util.UUID

/** Токены и значения в памяти: темы одной дизайн-системы проекта [projectId], ревизии и значения по теме и токену. */
internal class FakeSizeTokenRepository(
    val designSystemId: UUID = UUID.randomUUID(),
    private val projectId: String = "project-1",
    tenantIds: List<UUID> = listOf(UUID.randomUUID()),
) : SizeTokenRepository {
    /** Определение токена. */
    data class Definition(val id: UUID, val name: String, val type: ThemeTokenType?)

    val revisions: MutableMap<UUID, Int> = tenantIds.associateWith { 0 }.toMutableMap()
    val definitions = mutableListOf<Definition>()
    val values = mutableMapOf<Pair<UUID, UUID>, Map<ThemeTokenPlatform, SizeStoredValue>>()
    var lockedAllThemes: Boolean? = null

    /** Добавляет определение со значениями [stored] во всех темах и возвращает его идентификатор. */
    fun define(
        name: String,
        type: ThemeTokenType?,
        stored: List<SizeWrittenValue> = emptyList(),
    ): UUID = UUID.randomUUID().also { id ->
        definitions += Definition(id, name, type)
        revisions.keys.forEach { tenant -> values[tenant to id] = stored.toStored() }
    }

    /** Идентификатор определения по имени. */
    fun id(name: String): UUID = definitions.single { it.name == name }.id

    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant? =
        revisions[tenantId]?.let { SizeTokenTenant(designSystemId, it, projectId.value == this.projectId) }

    override suspend fun lock(
        projectId: ProjectId,
        tenantId: UUID,
        editRevision: Int,
        allThemes: Boolean,
    ): SizeTokenLock {
        lockedAllThemes = allThemes
        val current = revisions[tenantId]?.takeIf { projectId.value == this.projectId }
            ?: return SizeTokenLock.NotFound
        if (current != editRevision) return SizeTokenLock.RevisionConflict(current)
        val locked = if (allThemes) revisions.keys.sorted() else listOf(tenantId)
        return SizeTokenLock.Locked(designSystemId, locked, current)
    }

    override suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken> =
        definitions.filter { it.type in SIZE_TYPES }.map { stored(it, tenantId) }

    override suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken? =
        definitions.firstOrNull { it.id == tokenId }
            ?.takeIf { designSystemId == this.designSystemId }
            ?.let { stored(it, tenantId) }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        definitions.map { it.name }.filter { it in names }.toSet()

    override suspend fun insert(designSystemId: UUID, type: ThemeTokenType, names: List<String>): Map<String, UUID> =
        names.associateWith { define(it, type) }

    override suspend fun replaceValues(tenantIds: Collection<UUID>, tokenId: UUID, values: List<SizeWrittenValue>) {
        tenantIds.forEach { tenant -> this.values[tenant to tokenId] = values.toStored() }
    }

    override suspend fun delete(tokenIds: Collection<UUID>) {
        definitions.removeAll { it.id in tokenIds }
        values.keys.removeAll { it.second in tokenIds }
    }

    override suspend fun bumpRevisions(tenantIds: Collection<UUID>): Map<UUID, Int> =
        tenantIds.associateWith { tenant -> revisions.getValue(tenant).plus(1).also { revisions[tenant] = it } }

    private fun stored(definition: Definition, tenantId: UUID) =
        StoredSizeToken(definition.id, definition.name, definition.type, values[tenantId to definition.id].orEmpty())

    private fun List<SizeWrittenValue>.toStored() =
        associate { it.platform to SizeStoredValue(it.value, it.overridden) }

    private companion object {
        val SIZE_TYPES = setOf(ThemeTokenType.SHAPE, ThemeTokenType.SPACING, ThemeTokenType.SHADOW)
    }
}
