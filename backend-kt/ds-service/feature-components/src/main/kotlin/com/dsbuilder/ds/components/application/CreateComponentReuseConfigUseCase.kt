package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentReuseConfig
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a reuse configuration below a writable design system. */
class CreateComponentReuseConfigUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentReuseConfigRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: ComponentReuseConfigRepository.Create,
        idempotencyKey: String? = null,
    ): DsResult<ComponentReuseConfig> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-component-reuse-config",
        command,
        { repository.findAccessible(context.projectId, context.principal.systemAdmin, it) },
        { repository.createAccessible(context.projectId, context.principal.systemAdmin, command) },
        ComponentReuseConfig::id,
    )
}
