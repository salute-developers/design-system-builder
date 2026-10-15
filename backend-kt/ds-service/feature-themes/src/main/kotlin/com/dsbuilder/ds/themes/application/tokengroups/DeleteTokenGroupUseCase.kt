package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import java.util.UUID

/**
 * Удаляет группу или подгруппу вместе с подгруппами и определениями их токенов: значения во всех темах и привязки к
 * группам палитры удаляются каскадом, ссылки значений компонентов становятся `null`.
 */
class DeleteTokenGroupUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val groups: TokenGroupRepository,
) {
    /** Удаление узла [groupId] дизайн-системы темы [tenantId]; результат — новая ревизия темы. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID, groupId: UUID, editRevision: Int): DsResult<Int> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required {
            tokens.withAllThemes(context, tenantId, editRevision) { lock ->
                val group = groups.find(lock.designSystemId, groupId)
                    ?: return@withAllThemes DsResult.Failure(DsFailure.NotFound)
                val tree = groups.list(lock.designSystemId, group.kind)
                val removed = listOf(groupId) + tree.filter { it.parentId == groupId }.map { it.id }
                tokens.deleteDefinitions(tokens.placedIn(lock.designSystemId, removed).map { it.id })
                groups.delete(removed)
                val remainingSiblings = tree.filter { it.parentId == group.parentId && it.id != groupId }.map { it.id }
                groups.arrange(group.parentId, remainingSiblings)
                DsResult.Success(tokens.bumpRevisions(lock.tenantIds).getValue(tenantId))
            }
        }
    }
}
