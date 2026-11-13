package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Проверяет прежние права удаления/записи и выполняет исправление в одной транзакции. */
class RepairCoreProblemUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: CoreProblemRepairRepository,
) {
    /** Проверяет права до поиска источника. */
    suspend fun execute(context: DsRequestContext, command: RepairCoreProblem): DsResult<Unit> {
        if (command.expectedRevision < 0) return DsResult.Failure(DsFailure.InvalidRequest("invalid_revision"))
        return policy.read(context, ProjectScope.COMPONENT_VARIATIONS_DELETE) {
            val writeAccess = if (command.targetPropertyId != null) {
                policy.require(context, ProjectScope.COMPONENT_VARIATIONS_WRITE)
            } else {
                DsResult.Success(Unit)
            }
            when (writeAccess) {
                is DsResult.Failure -> writeAccess
                is DsResult.Success -> transactions.required(context) {
                    guardEditorRules { repository.repair(context.projectId, context.principal.globalAdmin, command) }
                }
            }
        }
    }
}
