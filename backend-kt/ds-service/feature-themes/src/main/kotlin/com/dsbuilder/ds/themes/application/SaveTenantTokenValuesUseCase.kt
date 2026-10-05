package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Атомарно сохраняет полный набор platform-specific значений темы. */
class SaveTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Выполняет сохранение для trusted project. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: SaveTenantTokenValues,
    ): DsResult<TenantTokenValuesSaveOutcome.Saved> = when (
        val allowed = policy.require(
            context,
            ProjectScope.TENANTS_WRITE,
        )
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> if (command.values.duplicateKey()) {
            DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        } else {
            transactions.required {
                when (val outcome = repository.saveTokenValues(context.projectId, id, command)) {
                    is TenantTokenValuesSaveOutcome.Saved -> DsResult.Success(outcome)
                    is TenantTokenValuesSaveOutcome.RevisionConflict -> DsResult.Failure(
                        DsFailure.Conflict("TENANT_EDIT_CONFLICT", editRevision = outcome.editRevision),
                    )
                    TenantTokenValuesSaveOutcome.NotFound -> DsResult.Failure(DsFailure.NotFound)
                    TenantTokenValuesSaveOutcome.ForeignToken -> DsResult.Failure(
                        DsFailure.InvalidRequest("invalid_tenant_token"),
                    )
                }
            }
        }
    }
}

private fun List<com.dsbuilder.ds.themes.domain.TenantTokenValueInput>.duplicateKey(): Boolean =
    map { "${it.tokenId}:${it.platform.wireValue}:${it.mode?.wireValue}" }.let { it.size != it.toSet().size }
