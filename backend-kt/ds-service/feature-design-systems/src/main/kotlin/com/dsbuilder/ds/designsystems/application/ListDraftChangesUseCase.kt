package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.draftChangeDisplayCount

/** Возвращает вычисляемый журнал черновика или публикации. */
class ListDraftChangesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: DraftChangeRepository,
    private val aggregates: DesignSystemAggregateRepository,
) {
    /** Читает отличия выбранной границы с проверкой права просмотра. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): DsResult<List<DraftChange>> = read(context, designSystemId, versionId) { it }

    /** Возвращает только число отображаемых строк без передачи журнала и значений в оболочку. */
    suspend fun summary(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): DsResult<Int> = read(context, designSystemId, versionId) { changes ->
        val types = aggregates.listTokens(context.projectId, designSystemId, null, null)
            .orEmpty().associate { it.id to it.type }
        draftChangeDisplayCount(changes, types)
    }

    private suspend fun <T> read(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        present: suspend (List<DraftChange>) -> T,
    ): DsResult<T> = when (val allowed = policy.require(context, "design-systems:read")) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly(context) {
            try {
                repository.list(context.projectId, context.principal.systemAdmin, designSystemId, versionId)
                    ?.let { changes -> DsResult.Success(present(changes)) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            } catch (_: DraftChangeLimitExceededException) {
                DsResult.Failure(
                    DsFailure.Unprocessable(
                        code = "JOURNAL_LIMIT_EXCEEDED",
                        message = "The journal exceeds the supported limit of 10000 changes",
                    ),
                )
            }
        }
    }
}
