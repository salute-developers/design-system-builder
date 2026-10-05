package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.TenantTokenValue
import java.util.UUID

/** Reads token values only for an accessible theme. */
class GetTenantTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<List<TenantTokenValue>> =
        when (val allowed = policy.require(context, ProjectScope.TENANTS_READ)) {
            is DsResult.Failure -> allowed
            is DsResult.Success -> transactions.readOnly {
                repository.tokenValues(context.projectId, id)?.let { DsResult.Success(it) }
                    ?: if (context.principal.systemAdmin) {
                        DsResult.Success(emptyList())
                    } else {
                        DsResult.Failure(DsFailure.NotFound)
                    }
            }
        }
}
