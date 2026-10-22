package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import java.util.UUID

/** Дублирует конфигурацию компонента; повтор с тем же ключом возвращает сохранённый результат. */
class DuplicateAppearanceConfigurationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
    private val repeatedRequests: IdempotentRequestRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        sourceId: UUID,
        name: String?,
        idempotencyKey: String? = null,
    ): DsResult<Appearance> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "duplicate-appearance-configuration",
        listOf(sourceId.toString(), name),
        { repository.findAppearance(context.projectId, context.principal.systemAdmin, it) },
        { repository.duplicateAppearance(context.projectId, context.principal.systemAdmin, sourceId, name) },
        Appearance::id,
        validateCreate = {
            repository.findAppearance(context.projectId, context.principal.systemAdmin, sourceId)?.let { source ->
                uniqueKeys.lock(source.designSystemId, "appearance-default", source.componentId.toString())
                name?.trim()?.lowercase()?.let {
                    uniqueKeys.lock(source.designSystemId, "appearance", "${source.componentId}:$it")
                }
            }
            null
        },
    )
}
