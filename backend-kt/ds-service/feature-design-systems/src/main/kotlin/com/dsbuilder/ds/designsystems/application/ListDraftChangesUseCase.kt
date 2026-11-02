package com.dsbuilder.ds.designsystems.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
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
    ): DsResult<List<DraftChange>> = when (val result = snapshot(context, designSystemId, versionId)) {
        is DsResult.Failure -> result
        is DsResult.Success -> DsResult.Success(
            result.value.changes.items,
            result.mutationMetadata,
            result.readContext,
            result.readPage,
        )
    }

    /** Возвращает записи и точный total из одного read-only снимка. */
    suspend fun snapshot(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): DsResult<DraftJournalRead> = when (val allowed = policy.require(context, "design-systems:read")) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly(
            context.copy(versionId = context.versionId ?: versionId?.value),
            ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId.value),
        ) { selected ->
            try {
                repository.pageAndSummary(
                    selected.projectId, selected.principal.systemAdmin, designSystemId,
                    selected.versionId?.let(::DesignSystemVersionId), selected.readQuery,
                )?.let { DsResult.Success(it, readPage = it.changes.page) } ?: DsResult.Failure(DsFailure.NotFound)
            } catch (_: DraftChangeLimitExceededException) {
                DsResult.Failure(
                    DsFailure.Unprocessable(
                        "JOURNAL_LIMIT_EXCEEDED",
                        "The journal exceeds the supported limit of 10000 changes",
                    ),
                )
            }
        }
    }

    /** Возвращает только число отображаемых строк без передачи журнала и значений в оболочку. */
    internal suspend fun summary(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): DsResult<Int> = projection(context, designSystemId, versionId) { selected ->
        repository.summary(
            selected.projectId,
            selected.principal.systemAdmin,
            designSystemId,
            selected.versionId?.let(::DesignSystemVersionId),
        )
    }

    /** Возвращает компактные отметки выбранной темы на той же границе чтения. */
    suspend fun tokenIds(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        tenantId: java.util.UUID,
    ): DsResult<Set<java.util.UUID>> = projection(context, designSystemId, null) { selected ->
        repository.changedTokenIds(
            selected.projectId,
            selected.principal.systemAdmin,
            designSystemId,
            selected.versionId?.let(::DesignSystemVersionId),
            tenantId,
        )
    }

    private suspend fun <T> projection(
        context: DsRequestContext,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        read: suspend (DsRequestContext) -> T?,
    ): DsResult<T> = when (val allowed = policy.require(context, "design-systems:read")) {
        is DsResult.Failure -> allowed
        is DsResult.Success -> transactions.readOnly(
            context.copy(versionId = context.versionId ?: versionId?.value),
            ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, designSystemId.value),
        ) { selected -> read(selected)?.let { DsResult.Success(it) } ?: DsResult.Failure(DsFailure.NotFound) }
    }
}
