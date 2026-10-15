package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/** Группы токенов одной дизайн-системы [designSystemId] в памяти. */
internal class FakeTokenGroupRepository(private val designSystemId: UUID) : TokenGroupRepository {
    val groups = mutableListOf<TokenGroup>()

    /** Добавляет группу (`parentId == null`) или подгруппу в конец соседей и возвращает её. */
    fun add(label: String, parentId: UUID? = null, code: String? = null): TokenGroup = TokenGroup(
        id = UUID.randomUUID(),
        designSystemId = designSystemId,
        kind = TokenGroupKind.COLOR,
        parentId = parentId,
        code = if (parentId == null) code ?: label.lowercase() else null,
        label = label,
        position = groups.count { it.parentId == parentId },
    ).also { groups += it }

    /** Узел по идентификатору. */
    fun get(id: UUID): TokenGroup = groups.single { it.id == id }

    /** Названия детей [parentId] по позиции. */
    fun labels(parentId: UUID?): List<String> =
        groups.filter { it.parentId == parentId }.sortedBy { it.position }.map { it.label }

    override suspend fun accessible(projectId: ProjectId, designSystemId: UUID) = designSystemId == this.designSystemId

    override suspend fun list(designSystemId: UUID, kind: TokenGroupKind): List<TokenGroup> =
        groups.filter { it.designSystemId == designSystemId && it.kind == kind }
            .sortedWith(compareBy({ it.parentId != null }, { it.position }))

    override suspend fun find(designSystemId: UUID, groupId: UUID): TokenGroup? =
        groups.firstOrNull { it.id == groupId && it.designSystemId == designSystemId }

    override suspend fun insert(group: NewTokenGroup): TokenGroup = TokenGroup(
        UUID.randomUUID(),
        group.designSystemId,
        group.kind,
        group.parentId,
        group.code,
        group.label,
        group.position,
    ).also { groups += it }

    override suspend fun arrange(parentId: UUID?, order: List<UUID>) {
        groups.replaceAll { group ->
            val index = order.indexOf(group.id)
            if (index < 0) group else group.copy(parentId = parentId, position = index)
        }
    }

    override suspend fun rename(groupId: UUID, label: String) {
        groups.replaceAll { if (it.id == groupId) it.copy(label = label) else it }
    }

    override suspend fun delete(groupIds: Collection<UUID>) {
        groups.removeAll { it.id in groupIds }
    }

    /** Сколько раз запрошена раскладка цветовых токенов. */
    var initialized = 0

    override suspend fun initializeColor(designSystemId: UUID) {
        initialized += 1
    }
}
