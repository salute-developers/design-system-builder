package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/**
 * Удаляет состояние цветового токена: определения состояния во всех подгруппах, их значения во всех темах и привязки
 * к группам палитры. Члены без состояния и другие состояния остаются.
 */
class DeleteColorTokenStateUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
) {
    /** Удаление состояния [state] семейства токена [tokenId] из темы [tenantId]; результат — новая ревизия темы. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        state: String,
        editRevision: Int,
    ): DsResult<ColorTokenMutation<Int>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        if (state !in ColorTokenFamily.STATES) {
            return DsResult.Failure(unknownState(state))
        }
        return transactions.required(context) {
            when (val lock = tokens.lock(context.projectId, tenantId, editRevision, allThemes = true)) {
                is ColorTokenLock.Locked -> when (
                    val found = tokens.family(lock.designSystemId, tokenId).storedOrFailure(tokenId)
                ) {
                    is DsResult.Failure -> found
                    is DsResult.Success -> delete(tenantId, lock, found.value, state)
                }
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    private suspend fun delete(
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        stored: StoredColorTokenFamily,
        state: String,
    ): DsResult<ColorTokenMutation<Int>> {
        val family = stored.family
        val member = "${family.name}-$state"
        val removed = stored.members.filterKeys { it.split('.').getOrNull(2) == member }
        // Состояния нет — `404`, как у отсутствующего токена.
        if (stateDefault(family, state) !in removed) return DsResult.Failure(DsFailure.NotFound)
        val ids = removed.values
        val groupIds = tokens.placedById(ids).mapNotNull { it.groupId }.toSet()
        tokens.deleteDefinitions(ids)
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        return DsResult.Success(
            ColorTokenMutation(
                revision,
                revision,
                tokens.confirmedStructure(lock.designSystemId, emptyList(), ids, groupIds),
            ),
        )
    }
}
