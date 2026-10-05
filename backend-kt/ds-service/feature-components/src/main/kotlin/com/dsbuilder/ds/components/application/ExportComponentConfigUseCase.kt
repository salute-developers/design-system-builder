package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentConfigPackage
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Exports the current component package for one accessible design system. */
class ExportComponentConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        query: ExportComponentConfig,
    ): DsResult<ComponentConfigPackage> = policy.read(context, ProjectScope.COMPONENTS_READ) {
        transactions.readOnly {
            when (val attempt = repository.export(context.projectId, context.principal.systemAdmin, query)) {
                is ComponentConfigRepository.ExportAttempt.Success -> DsResult.Success(attempt.value)
                ComponentConfigRepository.ExportAttempt.NotFound -> DsResult.Failure(DsFailure.NotFound)
                is ComponentConfigRepository.ExportAttempt.Failed -> DsResult.Failure(
                    DsFailure.Unprocessable("Export failed", attempt.reason),
                )
            }
        }
    }
}
