package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.IdempotentRequestRepository
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository

/** Создаёт пустую конфигурацию компонента; повтор с тем же ключом возвращает сохранённый результат. */
class CreateAppearanceConfigurationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
    private val repeatedRequests: IdempotentRequestRepository,
    private val uniqueKeys: UniqueKeyLockRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(
        context: DsRequestContext,
        command: AppearanceEditorRepository.NewAppearance,
        idempotencyKey: String? = null,
    ): DsResult<Appearance> = modelCreate(
        policy, transactions, repeatedRequests, context, idempotencyKey, "create-appearance-configuration", command,
        { repository.findAppearance(context.projectId, context.principal.systemAdmin, it) },
        { repository.createAppearance(context.projectId, context.principal.systemAdmin, command) },
        Appearance::id,
        validateCreate = {
            // Единственность конфигурации по умолчанию и имени проверяются под блокировкой ключей пары.
            uniqueKeys.lock(command.designSystemId, "appearance-default", command.componentId.toString())
            command.name?.trim()?.lowercase()?.let {
                uniqueKeys.lock(command.designSystemId, "appearance", "${command.componentId}:$it")
            }
            null
        },
    )
}
