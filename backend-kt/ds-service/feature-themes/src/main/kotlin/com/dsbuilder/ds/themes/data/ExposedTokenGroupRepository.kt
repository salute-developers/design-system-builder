package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.themes.application.tokengroups.NewTokenGroup
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.isNull
import org.jetbrains.exposed.v1.core.or
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
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

    override suspend fun insert(group: NewTokenGroup): TokenGroup {
        val id = UUID.randomUUID()
        StableTokenGroups.insert {
            it[StableTokenGroups.id] = id
            it[designSystemId] = group.designSystemId
            it[kind] = group.kind
            it[createdAt] = Instant.now()
        }
        TokenGroupRevisions.replace(id, group.designSystemId, setOf("/")) {
            it[TokenGroupRevisions.parentId] = group.parentId
            it[TokenGroupRevisions.code] = group.code
            it[TokenGroupRevisions.label] = group.label
            it[TokenGroupRevisions.position] = group.position
        }
        return requireNotNull(find(group.designSystemId, id))
    }

    override suspend fun arrange(parentId: UUID?, order: List<UUID>) {
        order.withIndex().sortedBy { it.value }.forEach { (position, id) ->
            revise(id, setOf("/parent_id", "/position")) { it.copy(parentId = parentId, position = position) }
        }
    }

    override suspend fun rename(groupId: UUID, label: String) {
        revise(groupId, setOf("/label")) { it.copy(label = label) }
    }

    override suspend fun delete(groupIds: Collection<UUID>) {
        groupIds.sorted().forEach { id ->
            val row = StableTokenGroups.selectAll().where { StableTokenGroups.id eq id }.singleOrNull()
                ?: return@forEach
            TokenGroupRevisions.replace(id, row[StableTokenGroups.designSystemId], setOf("/deleted"), removed = true)
        }
    }

    override suspend fun initializeColor(designSystemId: UUID) {
        initializeColorTokenGroups(designSystemId, this)
    }

    private fun revise(id: UUID, paths: Set<String>, transform: (TokenGroup) -> TokenGroup) {
        val stable = StableTokenGroups.selectAll().where { StableTokenGroups.id eq id }.singleOrNull() ?: return
        val owner = stable[StableTokenGroups.designSystemId]
        lockDraftSubject(owner, "token-group", id)
        val row = TokenGroupsTable.selectAll().where { TokenGroupsTable.id eq id }.singleOrNull() ?: return
        val before = group(row)
        val next = transform(before)
        if (next == before) return
        TokenGroupRevisions.replace(id, owner, paths) {
            it[TokenGroupRevisions.parentId] = next.parentId
            it[TokenGroupRevisions.code] = next.code
            it[TokenGroupRevisions.label] = next.label
            it[TokenGroupRevisions.position] = next.position
        }
    }

    private fun group(row: ResultRow) = TokenGroup(
        id = row[TokenGroupsTable.id],
        designSystemId = row[TokenGroupsTable.designSystemId],
        kind = row[TokenGroupsTable.kind],
        parentId = row[TokenGroupsTable.parentId],
        code = row[TokenGroupsTable.code],
        label = row[TokenGroupsTable.label],
        position = row[TokenGroupsTable.position],
        editRevision = row[TokenGroupsTable.editRevision],
    )
}
