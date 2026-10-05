package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion
import java.util.UUID

/** Gets one accessible design-system version. */
class GetDesignSystemVersionUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemVersionRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<DesignSystemVersion> = when (
        val allowed = policy.require(context, "design-systems:read")
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly {
            repository.find(context.projectId, id)?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
