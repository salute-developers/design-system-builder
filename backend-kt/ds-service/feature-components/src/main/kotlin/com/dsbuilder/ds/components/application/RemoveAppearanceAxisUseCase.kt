package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Удаляет ось оформления вместе с зависимыми значениями. */
class RemoveAppearanceAxisUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        axisId: UUID,
        confirmCascade: Boolean,
    ): DsResult<EditorRemoval> = modelMutate(policy, transactions, context, ProjectScope.COMPONENT_VARIATIONS_DELETE) {
        repository.removeAxis(context.projectId, context.principal.systemAdmin, appearanceId, axisId, confirmCascade)
    }
}
