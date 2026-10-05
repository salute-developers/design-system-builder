package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ResolvedStateSet
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Resolves a canonical state set, creating it when absent. */
class ResolveStateSetUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: StateRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, stateIds: List<UUID>): DsResult<ResolvedStateSet> {
        if (!context.principal.systemAdmin) return DsResult.Failure(DsFailure.Forbidden)
        return policy.read(context, ProjectScope.COMPONENT_VARIATIONS_WRITE) {
            transactions.required {
                when (val resolution = repository.resolve(stateIds)) {
                    is StateRepository.Resolution.Success -> DsResult.Success(resolution.value)
                    is StateRepository.Resolution.Invalid -> DsResult.Failure(
                        DsFailure.InvalidRequest("invalid_state_set", mapOf("reason" to resolution.reason)),
                    )
                }
            }
        }
    }
}
