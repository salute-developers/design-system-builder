package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/** Хранилище групп и подгрупп токенов; вызывается внутри транзакции use case. */
interface TokenGroupRepository {
    /** Доступна ли дизайн-система [designSystemId] проекту [projectId]. */
    suspend fun accessible(projectId: ProjectId, designSystemId: UUID): Boolean

    /** Группы и подгруппы вида [kind] дизайн-системы: по уровню, родителю и позиции. */
    suspend fun list(designSystemId: UUID, kind: TokenGroupKind): List<TokenGroup>

    /** Группа или подгруппа [groupId] дизайн-системы [designSystemId]. */
    suspend fun find(designSystemId: UUID, groupId: UUID): TokenGroup?

    /** Вставляет узел и возвращает его. */
    suspend fun insert(group: NewTokenGroup): TokenGroup

    /** Кладёт узлы [order] под родителя [parentId] на позиции, равные индексу. */
    suspend fun arrange(parentId: UUID?, order: List<UUID>)

    /** Меняет название узла. */
    suspend fun rename(groupId: UUID, label: String)

    /** Удаляет узлы [groupIds]. */
    suspend fun delete(groupIds: Collection<UUID>)

    /**
     * Раскладывает цветовые токены дизайн-системы по группам разделов и подгруппам категорий, если групп вида
     * `color` у неё ещё нет: так получают группы дизайн-системы, созданные в обход ds-service.
     */
    suspend fun initializeColor(designSystemId: UUID)
}

/** Код группы узла: свой у группы, родителя — у подгруппы. */
internal suspend fun TokenGroupRepository.codeOf(group: TokenGroup): String? =
    group.code ?: group.parentId?.let { find(group.designSystemId, it)?.code }
