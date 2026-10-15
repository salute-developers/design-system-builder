package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.tokengroups.NewTokenGroup
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insertReturning
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import java.time.Instant
import java.util.UUID

/** Exposed-хранилище групп и подгрупп токенов `token_groups`. */
class ExposedTokenGroupRepository : TokenGroupRepository {
    override suspend fun accessible(projectId: ProjectId, designSystemId: UUID): Boolean =
        ThemeDesignSystemsTable.selectAll()
            .where {
                (ThemeDesignSystemsTable.id eq designSystemId) and
                    (
                        (ThemeDesignSystemsTable.projectId eq projectId.value) or
                            ThemeDesignSystemsTable.projectId.isNull()
                        )
            }
            .limit(1)
            .any()

    override suspend fun list(designSystemId: UUID, kind: TokenGroupKind): List<TokenGroup> =
        TokenGroupsTable.selectAll()
            .where { (TokenGroupsTable.designSystemId eq designSystemId) and (TokenGroupsTable.kind eq kind) }
            .orderBy(TokenGroupsTable.position to SortOrder.ASC, TokenGroupsTable.label to SortOrder.ASC)
            .map(::group)
            // Сначала группы, затем подгруппы по порядку их групп.
            .let { rows ->
                val top = rows.filter { it.parentId == null }
                top + top.flatMap { parent -> rows.filter { it.parentId == parent.id } }
            }

    override suspend fun find(designSystemId: UUID, groupId: UUID): TokenGroup? =
        TokenGroupsTable.selectAll()
            .where { (TokenGroupsTable.id eq groupId) and (TokenGroupsTable.designSystemId eq designSystemId) }
            .limit(1)
            .singleOrNull()
            ?.let(::group)

    override suspend fun insert(group: NewTokenGroup): TokenGroup =
        TokenGroupsTable.insertReturning {
            it[designSystemId] = group.designSystemId
            it[kind] = group.kind
            it[parentId] = group.parentId
            it[code] = group.code
            it[label] = group.label
            it[position] = group.position
        }.single().let(::group)

    override suspend fun arrange(parentId: UUID?, order: List<UUID>) {
        order.forEachIndexed { index, groupId ->
            TokenGroupsTable.update({ TokenGroupsTable.id eq groupId }) {
                it[TokenGroupsTable.parentId] = parentId
                it[position] = index
                it[updatedAt] = Instant.now()
            }
        }
    }

    override suspend fun rename(groupId: UUID, label: String) {
        TokenGroupsTable.update({ TokenGroupsTable.id eq groupId }) {
            it[TokenGroupsTable.label] = label
            it[updatedAt] = Instant.now()
        }
    }

    override suspend fun delete(groupIds: Collection<UUID>) {
        if (groupIds.isNotEmpty()) TokenGroupsTable.deleteWhere { TokenGroupsTable.id inList groupIds }
    }

    override suspend fun initializeColor(designSystemId: UUID) {
        // Раскладка — функция миграции V6: правила разделов и категорий записаны один раз, в SQL.
        TransactionManager.current().exec("SELECT token_groups_initialize_color('$designSystemId'::uuid)")
    }

    private fun group(row: ResultRow) = TokenGroup(
        id = row[TokenGroupsTable.id],
        designSystemId = row[TokenGroupsTable.designSystemId],
        kind = row[TokenGroupsTable.kind],
        parentId = row[TokenGroupsTable.parentId],
        code = row[TokenGroupsTable.code],
        label = row[TokenGroupsTable.label],
        position = row[TokenGroupsTable.position],
    )
}
