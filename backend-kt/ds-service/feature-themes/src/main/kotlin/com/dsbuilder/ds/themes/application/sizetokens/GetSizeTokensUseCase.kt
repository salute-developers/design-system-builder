package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import java.util.UUID

/**
 * Радиусы, отступы и тени темы в px со своими значениями платформ, использованием компонентами и вычисляемыми
 * радиусами. Токены вне правил имён в ответ не входят.
 */
class GetSizeTokensUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
) {
    /** Читает раздел темы [tenantId]; `canEdit` — право `tenants:write` на тему своего проекта. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<SizeTokens> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                tokens.tenant(context.projectId, tenantId)?.let { tenant ->
                    val writable = policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success
                    val views = usage.views(tenant.designSystemId, tokens.tokens(tenant.designSystemId, tenantId))
                    val dimensions = views.filterIsInstance<DimensionTokenView>()
                    DsResult.Success(
                        SizeTokens(
                            editRevision = tenant.editRevision,
                            canEdit = writable && tenant.owned,
                            radii = dimensions.filter { it.kind == SizeTokenKind.RADIUS },
                            spacing = dimensions.filter { it.kind == SizeTokenKind.SPACING },
                            shadows = views.filterIsInstance<ShadowTokenView>(),
                        ),
                    )
                } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
