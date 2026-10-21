package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.sizetokens.DimensionTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.ShadowTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import java.util.UUID

/**
 * Радиусы, отступы и тени темы в px со своими значениями платформ, использованием компонентами и вычисляемыми
 * радиусами на границе контекста: активный черновик или опубликованная версия `versionId`. Токены вне правил имён
 * в ответ не входят.
 */
class GetSizeTokensUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
    private val palette: TenantPaletteRepository,
) {
    /** Читает раздел темы [tenantId]; `canEdit` — право `tenants:write` на тему своего проекта вне опубликованной версии. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<SizeTokens> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                tokens.tenant(context.projectId, tenantId)?.let { tenant ->
                    val writable = policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success
                    val resolve = ShadowColorPalette(palette).resolver(context.projectId, tenantId)
                    val stored = tokens.tokens(tenant.designSystemId, tenantId)
                    val views = usage.views(tenant.designSystemId, stored, resolve)
                    val dimensions = views.filterIsInstance<DimensionTokenView>()
                    DsResult.Success(
                        SizeTokens(
                            canEdit = writable && tenant.owned && context.versionId == null,
                            radii = dimensions.filter { it.kind == SizeTokenKind.RADIUS },
                            spacing = dimensions.filter { it.kind == SizeTokenKind.SPACING },
                            shadows = views.filterIsInstance<ShadowTokenView>(),
                        ),
                    )
                } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
