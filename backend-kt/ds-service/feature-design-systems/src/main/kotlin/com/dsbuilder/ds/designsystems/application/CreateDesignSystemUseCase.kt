package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DesignSystemTokenInitializer
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentCreateExecutor
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystem
import com.dsbuilder.ds.designsystems.domain.DesignSystemId

/** Creates a design system owned by the trusted project. */
class CreateDesignSystemUseCase(
    private val accessPolicy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DesignSystemRepository,
    private val versionBoundaries: VersionBoundaryRepository,
    private val tokenInitializer: DesignSystemTokenInitializer,
    private val repeatedCreates: IdempotentCreateExecutor,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: CreateDesignSystem,
        idempotencyKey: String? = null,
    ): DsResult<DesignSystem> =
        when (val authorization = accessPolicy.require(context, "design-systems:write")) {
            is DsResult.Failure -> authorization
            is DsResult.Success -> transactions.required(context) {
                repeatedCreates.execute(
                    context,
                    idempotencyKey,
                    "create-design-system",
                    command,
                    { id -> repository.findAccessible(context.projectId, DesignSystemId(id)) },
                    {
                        repository.createOwned(context.projectId, command).also {
                            versionBoundaries.initializeBaseline(it)
                            tokenInitializer.initialize(it.id.value)
                            versionBoundaries.initializeDraft(it.id)
                        }
                    },
                    { it.id.value },
                )
            }
        }
}
