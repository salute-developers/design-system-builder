package com.dsbuilder.ds.themes.application.palette

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.palette.ThemePalette
import java.util.UUID

/** Палитра темы: группы, состав, значения, привязки токенов и копия шаблона. */
class GetTenantPaletteUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantPaletteRepository,
) {
    /**
     * Читает палитру без ленивой инициализации. Опубликованная граница доступна только для просмотра.
     */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<ThemePalette> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly(context) {
                val writable = context.versionId == null &&
                    policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success
                repository.snapshot(context.projectId, tenantId, includeSubjectRevisions = true)?.let { snapshot ->
                    if (!snapshot.hasSystemGroups()) return@readOnly DsResult.Failure(DsFailure.NotFound)
                    val palette = snapshot.palette(tenantId.toString(), writable && snapshot.owned)
                    DsResult.Success(palette.copy(subjectRevisions = snapshot.subjectRevisions))
                } ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
