package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.sizetokens.SizeStoredValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue
import java.util.UUID

/**
 * Токены и значения в памяти: темы одной дизайн-системы проекта [projectId]. Запись значения запоминает базовые
 * редакции и число записанных значений; удаление — логическое (определение помечается удалённым).
 */
internal class FakeSizeTokenRepository(
    val designSystemId: UUID = UUID.randomUUID(),
    private val projectId: String = "project-1",
    val tenantIds: List<UUID> = listOf(UUID.randomUUID()),
) : SizeTokenRepository {
    /** Определение токена. */
    data class Definition(val id: UUID, val name: String, val type: ThemeTokenType?, val deleted: Boolean = false)

    val definitions = mutableListOf<Definition>()
    val values = mutableMapOf<Pair<UUID, UUID>, Map<ThemeTokenPlatform, SizeStoredValue>>()
    val baseRevisions = mutableListOf<Map<ThemeTokenPlatform, Long>>()
    var locks = 0

    /** Добавляет определение со значениями [stored] во всех темах и возвращает его идентификатор. */
    fun define(
        name: String,
        type: ThemeTokenType?,
        stored: List<SizeWrittenValue> = emptyList(),
    ): UUID = UUID.randomUUID().also { id ->
        definitions += Definition(id, name, type)
        tenantIds.forEach { tenant -> values[tenant to id] = stored.toStored() }
    }

    /** Идентификатор действующего определения по имени. */
    fun id(name: String): UUID = definitions.single { it.name == name && !it.deleted }.id

    /** Копия состояния для отката транзакции. */
    fun state() = definitions.toList() to values.toMap()

    /** Возвращает состояние [state], как откат транзакции. */
    fun restore(state: Pair<List<Definition>, Map<Pair<UUID, UUID>, Map<ThemeTokenPlatform, SizeStoredValue>>>) {
        definitions.clear()
        definitions += state.first
        values.clear()
        values += state.second
    }

    override suspend fun tenant(projectId: ProjectId, tenantId: UUID): SizeTokenTenant? =
        tenantId.takeIf { it in tenantIds }?.let { SizeTokenTenant(designSystemId, projectId.value == this.projectId) }

    override suspend fun lock(projectId: ProjectId, tenantId: UUID): UUID? {
        locks++
        return designSystemId.takeIf { tenantId in tenantIds && projectId.value == this.projectId }
    }

    override suspend fun tokens(designSystemId: UUID, tenantId: UUID): List<StoredSizeToken> =
        definitions.filter { !it.deleted }.map { stored(it, tenantId) }

    override suspend fun token(designSystemId: UUID, tenantId: UUID, tokenId: UUID): StoredSizeToken? =
        definitions.firstOrNull { it.id == tokenId && !it.deleted }
            ?.takeIf { designSystemId == this.designSystemId }
            ?.let { stored(it, tenantId) }

    override suspend fun takenNames(designSystemId: UUID, names: Collection<String>): Set<String> =
        definitions.filter { !it.deleted }.map { it.name }.filter { it in names }.toSet()

    override suspend fun writeValues(
        designSystemId: UUID,
        tenantId: UUID,
        tokenId: UUID,
        values: List<SizeWrittenValue>,
        baseRevisions: Map<ThemeTokenPlatform, Long>,
    ) {
        this.baseRevisions += baseRevisions
        this.values[tenantId to tokenId] = values.toStored()
    }

    override suspend fun create(
        designSystemId: UUID,
        type: ThemeTokenType,
        values: Map<String, List<SizeWrittenValue>>,
    ): Map<String, UUID> = values.mapValues { (name, written) -> define(name, type, written) }

    override suspend fun delete(designSystemId: UUID, tokenIds: List<UUID>) {
        definitions.replaceAll { if (it.id in tokenIds) it.copy(deleted = true) else it }
        values.keys.removeAll { it.second in tokenIds }
    }

    private fun stored(definition: Definition, tenantId: UUID) =
        StoredSizeToken(definition.id, definition.name, definition.type, values[tenantId to definition.id].orEmpty())

    private fun List<SizeWrittenValue>.toStored() =
        associate { it.platform to SizeStoredValue(it.value, it.overridden) }
}
