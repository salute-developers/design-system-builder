package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Gets one accessible design system without revealing foreign resources. */
class GetDesignSystemUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: DesignSystemId): DsResult<DesignSystem> =
        when (val authorization = accessPolicy.require(context, "design-systems:read")) {
            is DsResult.Failure -> authorization
            is DsResult.Success -> transactions.readOnly {
                repository.findAccessible(context.projectId, id)?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
