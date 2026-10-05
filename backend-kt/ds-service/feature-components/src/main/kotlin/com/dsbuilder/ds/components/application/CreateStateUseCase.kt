package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentState
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates a state as a system administrator. */
class CreateStateUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, command: StateRepository.Create): DsResult<ComponentState> =
        systemAdminMutate(policy, transactions, context) { repository.create(command) }
}
