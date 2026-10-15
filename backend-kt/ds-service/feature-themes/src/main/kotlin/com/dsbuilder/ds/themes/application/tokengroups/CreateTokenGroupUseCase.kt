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
import com.dsbuilder.ds.themes.domain.tokengroups.Ordering
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupRules
import java.util.UUID

/** Создаёт группу или подгруппу токенов и увеличивает ревизии всех тем дизайн-системы. */
class CreateTokenGroupUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val groups: TokenGroupRepository,
) {
    /** Создание узла [command] в дизайн-системе темы [tenantId]. */
    @Suppress("ReturnCount")
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        command: CreateTokenGroup,
    ): DsResult<ColorTokenMutation<TokenGroup>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        TokenGroupRules.label(command.label)?.let { return DsResult.Failure(invalidTokenGroup(it)) }
        val code = if (command.parentId == null) {
            TokenGroupRules.codeFromLabel(command.label)
                ?: return DsResult.Failure(invalidTokenGroup("В названии группы нужны латинские буквы или цифры"))
        } else {
            null
        }
        return transactions.required {
            tokens.withAllThemes(context, tenantId, command.editRevision) { lock ->
                create(tenantId, lock, command, code)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun create(
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        command: CreateTokenGroup,
        code: String?,
    ): DsResult<ColorTokenMutation<TokenGroup>> {
        // Первая группа дизайн-системы не должна оставить её токены без раскладки по разделам.
        groups.initializeColor(lock.designSystemId)
        command.parentId?.let { parentId ->
            val parent = groups.find(lock.designSystemId, parentId) ?: return DsResult.Failure(DsFailure.NotFound)
            if (parent.parentId != null) {
                return DsResult.Failure(invalidTokenGroup("Подгруппа не может содержать подгруппы"))
            }
            if (parent.kind != command.kind) return DsResult.Failure(invalidTokenGroup("Группа другого вида токенов"))
        }
        val siblings = groups.list(lock.designSystemId, command.kind).filter { it.parentId == command.parentId }
        if (siblings.any { TokenGroupRules.sameLabel(it.label, command.label) }) {
            return DsResult.Failure(tokenGroupConflict(command.label))
        }
        val inserted = groups.insert(
            NewTokenGroup(
                lock.designSystemId,
                command.kind,
                command.parentId,
                code,
                command.label.trim(),
                siblings.size,
            ),
        )
        val order = Ordering.place(siblings.map { it.id }, inserted.id, command.position)
        groups.arrange(command.parentId, order)
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        return DsResult.Success(ColorTokenMutation(revision, inserted.copy(position = order.indexOf(inserted.id))))
    }
}
