package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange

/** Возвращает вычисляемый журнал черновика или публикации. */
class ListDraftChangesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DraftChangeRepository,
) {
    /** Читает отличия выбранной границы с проверкой права просмотра. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): DsResult<List<DraftChange>> = when (val allowed = policy.require(context, "design-systems:read")) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly(context) {
            repository.list(context.projectId, context.principal.systemAdmin, designSystemId, versionId)
                ?.let { changes -> DsResult.Success(changes) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
