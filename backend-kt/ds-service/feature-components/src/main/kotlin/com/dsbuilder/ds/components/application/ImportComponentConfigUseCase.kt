package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Imports a package in one transaction, including dry-run rollback and change journaling. */
class ImportComponentConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ImportComponentConfig,
    ): DsResult<ComponentConfigImportResult> = policy.read(context, ProjectScope.COMPONENTS_WRITE) {
        val execute = suspend {
            when (val attempt = repository.import(context.projectId, context.principal.systemAdmin, command)) {
                is ComponentConfigRepository.ImportAttempt.Success -> DsResult.Success(attempt.value)
                ComponentConfigRepository.ImportAttempt.NotFound -> DsResult.Failure(DsFailure.NotFound)
                ComponentConfigRepository.ImportAttempt.GlobalForbidden -> DsResult.Failure(DsFailure.Forbidden)
                is ComponentConfigRepository.ImportAttempt.Failed -> DsResult.Failure(
                    DsFailure.Unprocessable("Import failed", attempt.reason),
                )
            }
        }
        if (command.dryRun) transactions.rollback(execute) else transactions.required(execute)
    }
}
