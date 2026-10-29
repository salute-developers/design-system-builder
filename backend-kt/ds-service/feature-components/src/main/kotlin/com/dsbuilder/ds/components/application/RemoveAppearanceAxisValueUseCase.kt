package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Удаляет значение оси оформления вместе с зависимыми значениями. */
class RemoveAppearanceAxisValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        valueId: UUID,
        confirmCascade: Boolean,
    ): DsResult<EditorRemoval> = modelMutate(policy, transactions, context, ProjectScope.COMPONENT_VARIATIONS_DELETE) {
        val admin = context.principal.systemAdmin
        repository.removeAxisValue(context.projectId, admin, appearanceId, valueId, confirmCascade)
    }
}
