package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Deletes an accessible reuse configuration. */
class DeleteComponentReuseConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentReuseConfigRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> =
        policy.read(context, ProjectScope.COMPONENTS_DELETE) {
            transactions.required {
                if (repository.deleteAccessible(context.projectId, context.principal.systemAdmin, id)) {
                    DsResult.Success(Unit)
                } else {
                    DsResult.Failure(DsFailure.NotFound)
                }
            }
        }
}
