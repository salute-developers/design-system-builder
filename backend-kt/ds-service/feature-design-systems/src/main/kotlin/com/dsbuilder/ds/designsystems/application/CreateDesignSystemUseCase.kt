package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystem

/** Creates a design system owned by the trusted project. */
class CreateDesignSystemUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
    private val tokenInitializer: DesignSystemTokenInitializer,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: CreateDesignSystem): DsResult<DesignSystem> =
        when (val authorization = accessPolicy.require(context, "design-systems:write")) {
            is DsResult.Failure -> authorization
            is DsResult.Success -> transactions.required {
                repository.createOwned(context.projectId, command).also {
                    tokenInitializer.initialize(it.id.value)
                }.let { DsResult.Success(it) }
            }
        }
}
