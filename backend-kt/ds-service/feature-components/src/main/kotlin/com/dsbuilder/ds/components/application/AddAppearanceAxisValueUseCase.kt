package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Добавляет значение оси оформления; повтор с тем же ключом возвращает сохранённый результат. */
class AddAppearanceAxisValueUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        axisId: UUID,
        command: AppearanceEditorRepository.AxisValueCreate,
        idempotencyKey: String? = null,
    ): DsResult<EditorAxisValue> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "add-appearance-axis-value",
        listOf(appearanceId, axisId, command),
        { id ->
            repository.model(context.projectId, context.principal.systemAdmin, appearanceId, null)
                ?.axes?.flatMap { it.values }?.firstOrNull { it.id == id }
        },
        { repository.addAxisValue(context.projectId, context.principal.systemAdmin, appearanceId, axisId, command) },
        EditorAxisValue::id,
    )
}
