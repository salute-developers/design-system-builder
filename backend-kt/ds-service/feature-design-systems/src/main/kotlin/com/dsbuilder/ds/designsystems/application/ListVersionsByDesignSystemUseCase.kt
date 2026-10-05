package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersion

/** Lists versions below one accessible design system. */
class ListVersionsByDesignSystemUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemVersionRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: DesignSystemId): DsResult<List<DesignSystemVersion>> =
        when (val allowed = policy.require(context, "design-systems:read")) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                repository.listByDesignSystem(context.projectId, id)?.let { DsResult.Success(it) }
                    ?: if (context.principal.systemAdmin) {
                        DsResult.Success(emptyList())
                    } else {
                        DsResult.Failure(DsFailure.NotFound)
                    }
            }
        }
}
