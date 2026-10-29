package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Удаляет значение свойства оформления для области и набора состояний. */
class RemoveAppearancePropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueScope,
    ): DsResult<Unit> = modelDelete(policy, transactions, context) {
        repository.removePropertyValue(context.projectId, context.principal.systemAdmin, appearanceId, command)
    }
}
