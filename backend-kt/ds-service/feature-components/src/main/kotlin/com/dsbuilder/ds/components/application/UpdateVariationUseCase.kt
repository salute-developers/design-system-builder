package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.ComponentVariationSummary
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Обновляет вариацию каталога; изменение имени доступно только системному администратору. */
class UpdateVariationUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentModelRepository,
) {
    /** Performs the execute operation. */
    suspend fun execute(
        context: DsRequestContext,
        id: UUID,
        command: ComponentModelRepository.VariationUpdate,
    ): DsResult<ComponentVariationSummary> = when {
        // Имя вариации каталога общее для всех дизайн-систем: его меняет только системный администратор.
        command.name != null && !context.principal.systemAdmin -> DsResult.Failure(DsFailure.Forbidden)
        else -> modelMutate(policy, transactions, context) {
            repository.updateVariation(context.projectId, context.principal.systemAdmin, id, command)
        }
    }
}
