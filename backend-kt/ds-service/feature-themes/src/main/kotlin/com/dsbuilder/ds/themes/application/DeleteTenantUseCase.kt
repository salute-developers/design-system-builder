package com.dsbuilder.ds.themes.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenFamilyTypeSync
import java.util.UUID

/**
 * Deletes one project-owned theme. Значения удалённой темы больше не участвуют в типе семейств цветовых токенов,
 * поэтому [familyTypes] пересчитывает их в той же транзакции.
 */
class DeleteTenantUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TenantRepository,
    private val familyTypes: ColorTokenFamilyTypeSync? = null,
) {
    /** Performs the execute operation. */
    suspend fun execute(context: DsRequestContext, id: UUID): DsResult<Unit> = when (
        val allowed = policy.require(context, ProjectScope.TENANTS_DELETE)
    ) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.required(context) {
            val designSystemId = familyTypes?.let { repository.findAccessible(context.projectId, id)?.designSystemId }
            if (repository.deleteOwned(context.projectId, id)) {
                designSystemId?.let { familyTypes?.syncTenantFamilies(it, id) }
                DsResult.Success(Unit)
            } else {
                DsResult.Failure(DsFailure.NotFound)
            }
        }
    }
}
