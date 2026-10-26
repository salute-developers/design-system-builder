package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/**
 * Группы и подгруппы токенов выбранной версии, включая пустые. Чтение не инициализирует данные.
 */
class ListTokenGroupsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val groups: TokenGroupRepository,
) {
    /** Узлы вида [kind] дизайн-системы [designSystemId]. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
        kind: TokenGroupKind,
    ): DsResult<List<TokenGroup>> =
        when (val allowed = policy.require(context, ProjectScope.TOKENS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(
                context,
                ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId),
            ) { selected ->
                if (groups.accessible(selected.projectId, designSystemId)) {
                    groups.page(designSystemId, kind, selected.readQuery)
                        .let { DsResult.Success(it.items, readPage = it.page) }
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
