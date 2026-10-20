package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleBuilder
import com.dsbuilder.ds.themes.domain.typography.TypographyStyles
import com.dsbuilder.ds.themes.domain.typography.TypographyUsage
import java.util.UUID

/** Стили типографии темы по экранам в px, семейства шрифтов и использование стилей в компонентах. */
class GetTypographyStylesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
) {
    /** Читает стили темы [tenantId]; `canEdit` — право `tenants:write`. */
    suspend fun execute(context: DsRequestContext, tenantId: UUID): DsResult<TypographyStyles> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                val tenant = repository.tenant(context.projectId, tenantId)
                    ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val tokens = repository.styles(tenant.designSystemId, tenantId)
                val references = TypographyUsage.count(usage.references(tenant.designSystemId))
                DsResult.Success(
                    TypographyStyles(
                        editRevision = tenant.editRevision,
                        canEdit = policy.require(context, ProjectScope.TENANTS_WRITE) is DsResult.Success,
                        themeCount = repository.themeCount(tenant.designSystemId),
                        families = repository.families(tenant.designSystemId, tenantId),
                        screens = TypographyStyleBuilder.screens(tokens, references),
                    ),
                )
            }
        }
}
