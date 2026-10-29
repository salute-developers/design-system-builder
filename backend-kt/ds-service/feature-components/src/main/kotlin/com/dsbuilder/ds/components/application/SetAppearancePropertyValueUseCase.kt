package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Записывает значение свойства оформления для области и набора состояний. */
class SetAppearancePropertyValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        command: AppearanceEditorRepository.PropertyValueSet,
    ): DsResult<EditorPropertyValue> = modelMutate(policy, transactions, context) {
        repository.setPropertyValue(context.projectId, context.principal.systemAdmin, appearanceId, command)
    }
}
