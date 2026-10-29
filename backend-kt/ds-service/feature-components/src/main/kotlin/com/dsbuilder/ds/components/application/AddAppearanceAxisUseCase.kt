package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Добавляет ось с значениями в оформление; повтор с тем же ключом возвращает сохранённый результат. */
class AddAppearanceAxisUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
    private val repeatedRequests: IdempotentRequestRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        appearanceId: UUID,
        command: AppearanceEditorRepository.AxisCreate,
        idempotencyKey: String? = null,
    ): DsResult<EditorAxis> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "add-appearance-axis",
        listOf(appearanceId, command),
        { id ->
            repository.model(context.projectId, context.principal.systemAdmin, appearanceId, null)
                ?.axes?.firstOrNull { it.id == id }
        },
        { repository.addAxis(context.projectId, context.principal.systemAdmin, appearanceId, command) },
        EditorAxis::id,
    )
}
