package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Удаляет цветовой токен целиком: определения семейства, их значения во всех темах и привязки к группам палитры. */
class DeleteColorTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
) {
    /** Удаление семейства токена [tokenId] из дизайн-системы темы [tenantId]; результат — новая ревизия темы. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        editRevision: Int,
    ): DsResult<ColorTokenMutation<Int>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_DELETE)
        if (allowed is DsResult.Failure) return allowed
        return transactions.required(context) {
            when (val lock = tokens.lock(context.projectId, tenantId, editRevision, allThemes = true)) {
                is ColorTokenLock.Locked -> when (
                    val found = tokens.family(lock.designSystemId, tokenId).storedOrFailure(tokenId)
                ) {
                    is DsResult.Failure -> found
                    is DsResult.Success -> {
                        val groupIds = tokens.placedById(found.value.members.values).mapNotNull { it.groupId }.toSet()
                        tokens.deleteDefinitions(found.value.members.values, primaryTokenId = tokenId)
                        groupIds.forEach { group ->
                            tokens.arrange(group, tokens.placedIn(lock.designSystemId, listOf(group)).slots())
                        }
                        tokens.bumpRevisions(lock.tenantIds).getValue(tenantId).let { revision ->
                            DsResult.Success(
                                ColorTokenMutation(
                                    revision,
                                    revision,
                                    tokens.confirmedStructure(
                                        lock.designSystemId,
                                        emptyList(),
                                        found.value.members.values,
                                        groupIds,
                                    ),
                                ),
                            )
                        }
                    }
                }
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }
}
