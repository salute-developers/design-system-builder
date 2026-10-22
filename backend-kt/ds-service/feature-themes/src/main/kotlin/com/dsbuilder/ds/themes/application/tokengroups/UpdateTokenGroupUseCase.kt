package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLock
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenMutation
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenNaming
import com.dsbuilder.ds.themes.domain.tokengroups.Ordering
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupRules
import java.util.UUID

/**
 * Переименовывает и переставляет группу или подгруппу, переносит подгруппу в другую группу. При переносе в группу с
 * другим кодом первый сегмент имён токенов подгруппы меняется, идентификаторы определений сохраняются.
 */
class UpdateTokenGroupUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val groups: TokenGroupRepository,
) {
    /** Изменение узла [groupId] дизайн-системы темы [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        groupId: UUID,
        command: UpdateTokenGroup,
    ): DsResult<ColorTokenMutation<TokenGroup>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        command.label?.let(TokenGroupRules::label)?.let { return DsResult.Failure(invalidTokenGroup(it)) }
        return transactions.required(context) {
            tokens.withAllThemes(context, tenantId, command.editRevision) { lock ->
                update(tenantId, lock, groupId, command)
            }
        }
    }

    @Suppress("ReturnCount", "CyclomaticComplexMethod")
    private suspend fun update(
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        groupId: UUID,
        command: UpdateTokenGroup,
    ): DsResult<ColorTokenMutation<TokenGroup>> {
        val group = groups.find(lock.designSystemId, groupId) ?: return DsResult.Failure(DsFailure.NotFound)
        val parentId = command.parentId ?: group.parentId
        val moved = parentId != group.parentId
        if (moved) {
            if (group.parentId == null) return DsResult.Failure(invalidTokenGroup("Группу нельзя сделать подгруппой"))
            val parent = groups.find(lock.designSystemId, requireNotNull(parentId))
                ?: return DsResult.Failure(DsFailure.NotFound)
            if (parent.parentId != null) {
                return DsResult.Failure(invalidTokenGroup("Подгруппа не может содержать подгруппы"))
            }
            if (parent.kind != group.kind) return DsResult.Failure(invalidTokenGroup("Группа другого вида токенов"))
        }
        val all = groups.list(lock.designSystemId, group.kind)
        val siblings = all.filter { it.parentId == parentId && it.id != groupId }
        val label = command.label?.trim() ?: group.label
        if (siblings.any { TokenGroupRules.sameLabel(it.label, label) }) {
            return DsResult.Failure(tokenGroupConflict(label))
        }
        if (moved) {
            val code = groups.find(lock.designSystemId, requireNotNull(parentId))?.code
            val subgroupTokens = tokens.placedIn(lock.designSystemId, listOf(groupId))
            if (code != null) {
                tokens.renameAll(lock.designSystemId, subgroupTokens) { token ->
                    ColorTokenNaming.withGroup(token.name, code)
                }?.let { return DsResult.Failure(it) }
            }
            val formerSiblings = all.filter { it.parentId == group.parentId && it.id != groupId }.map { it.id }
            groups.arrange(group.parentId, formerSiblings)
        }
        val order = if (moved || command.position != null) {
            Ordering.place(siblings.map { it.id }, groupId, command.position).also { groups.arrange(parentId, it) }
        } else {
            null
        }
        if (label != group.label) groups.rename(groupId, label)
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        val updated = group.copy(
            parentId = parentId,
            label = label,
            position = order?.indexOf(groupId) ?: group.position,
        )
        return DsResult.Success(ColorTokenMutation(revision, updated))
    }
}
