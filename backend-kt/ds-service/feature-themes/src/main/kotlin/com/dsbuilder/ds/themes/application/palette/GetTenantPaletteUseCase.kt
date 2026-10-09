package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import java.util.UUID

/** Палитра темы: группы, состав, значения, привязки токенов и копия шаблона. */
class GetTenantPaletteUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantPaletteRepository,
) {
    /**
     * Читает палитру темы; `canEdit` — право `tenants:write` на тему своего проекта. Транзакция изменяющая:
     * теме без палитры (создана в обход `ds-service`) копия шаблона и системные группы создаются при чтении.
     */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<ThemePalette> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                val writable = policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success
                repository.initializedSnapshot(context.projectId, tenantId)?.let { snapshot ->
                    val palette = ThemePaletteBuilder.build(
                        tenantId.toString(),
                        writable && snapshot.owned,
                        snapshot.state,
                        snapshot.tokens,
                        snapshot.values,
                    )
                    DsResult.Success(palette)
                } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
