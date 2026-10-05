package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariation
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an appearance variation axis. */
class CreateAppearanceVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceRepository.VariationCreate,
    ): DsResult<AppearanceVariation> = modelMutate(policy, transactions, context) {
        repository.createVariation(context.projectId, context.principal.systemAdmin, command)
    }
}
