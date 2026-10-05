package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import java.util.UUID

/** Updates one project-owned design-system version. */
class UpdateDesignSystemVersionUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemVersionRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: UpdateDesignSystemVersion,
    ): DsResult<DesignSystemVersion> =
        when (val allowed = policy.require(context, "design-systems:write")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.required {
                repository.update(context.projectId, id, command)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
