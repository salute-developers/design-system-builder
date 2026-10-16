package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroup
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/**
 * Группы и подгруппы токенов дизайн-системы, включая пустые. Дизайн-система без групп получает раскладку цветовых
 * токенов при первом чтении.
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
            is DsResult.Success -> transactions.required {
                if (groups.accessible(context.projectId, designSystemId)) {
                    val listed = groups.list(designSystemId, kind)
                    if (listed.isEmpty() && kind == TokenGroupKind.COLOR) groups.initializeColor(designSystemId)
                    DsResult.Success(listed.ifEmpty { groups.list(designSystemId, kind) })
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
