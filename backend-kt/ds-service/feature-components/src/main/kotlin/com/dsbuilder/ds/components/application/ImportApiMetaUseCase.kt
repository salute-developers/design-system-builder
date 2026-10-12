package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ApiMetaImportReport
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/**
 * Imports an API-meta manifest into the global component layer in one transaction.
 *
 * The layer is shared by every design system of every project, so the operation is reserved for a
 * trusted system administrator. A dry run performs the whole work and rolls it back, so the report
 * matches what an applied import would do.
 */
class ImportApiMetaUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ApiMetaRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: ImportApiMeta): DsResult<ApiMetaImportReport> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        return policy.read(context, ProjectScope.COMPONENTS_WRITE) {
            val execute = suspend {
                when (val attempt = repository.import(context.principal.actorId, command)) {
                    is ApiMetaRepository.ImportAttempt.Success -> DsResult.Success(attempt.value)
                    is ApiMetaRepository.ImportAttempt.Failed -> DsResult.Failure(
                        DsFailure.Unprocessable("Import failed", attempt.reason),
                    )
                }
            }
            if (command.dryRun) transactions.rollback(execute) else transactions.required(execute)
        }
    }
}
