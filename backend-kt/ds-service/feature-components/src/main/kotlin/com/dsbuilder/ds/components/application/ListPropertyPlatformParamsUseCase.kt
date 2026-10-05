package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PropertyPlatformParam
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Lists accessible property platform params. */
class ListPropertyPlatformParamsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<PropertyPlatformParam>> =
        modelList(policy, transactions, context) {
            repository.listPlatformParams(context.projectId, context.principal.systemAdmin)
        }
}
