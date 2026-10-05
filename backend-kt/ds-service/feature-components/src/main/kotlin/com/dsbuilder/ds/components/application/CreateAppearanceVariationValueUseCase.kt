package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceVariationValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Creates an appearance variation value. */
class CreateAppearanceVariationValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceRepository.ValueCreate,
    ): DsResult<AppearanceVariationValue> = modelMutate(policy, transactions, context) {
        repository.createValue(context.projectId, context.principal.systemAdmin, command)
    }
}
