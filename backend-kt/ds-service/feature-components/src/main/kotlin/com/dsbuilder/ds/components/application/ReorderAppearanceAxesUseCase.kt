package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Задаёт порядок осей оформления. */
class ReorderAppearanceAxesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        axisIds: List<UUID>,
    ): DsResult<List<EditorAxis>> = modelMutate(policy, transactions, context) {
        repository.reorderAxes(context.projectId, context.principal.systemAdmin, appearanceId, axisIds)
    }
}
