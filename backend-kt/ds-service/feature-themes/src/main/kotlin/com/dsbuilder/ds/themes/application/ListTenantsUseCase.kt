package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.Tenant

/** Lists themes accessible through the trusted project. */
class ListTenantsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext): DsResult<List<Tenant>> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_READ)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> {
            val owner = context.designSystemId
            if (owner == null) {
                transactions.readOnly(context) { DsResult.Success(repository.listAccessible(context.projectId)) }
            } else {
                transactions.readOnly(
                    context,
                    ModelReadTarget(
                        ModelReadTarget.Kind.DESIGN_SYSTEM,
                        owner,
                    ),
                ) { selected ->
                    val page = repository.pageAccessible(selected.projectId, selected.readQuery)
                    DsResult.Success(page.items, readPage = page.page)
                }
            }
        }
    }
}
