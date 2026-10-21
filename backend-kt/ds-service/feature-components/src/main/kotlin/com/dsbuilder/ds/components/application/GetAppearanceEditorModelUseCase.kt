package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Читает модель оформления для редактора; `versionId` контекста выбирает опубликованную версию. */
class GetAppearanceEditorModelUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: AppearanceEditorRepository,
) {
    /** Выполняет сценарий. */
    suspend fun execute(context: DsRequestContext, appearanceId: UUID): DsResult<AppearanceEditorModel> =
        modelFind(policy, transactions, context) {
            repository.model(context.projectId, context.principal.systemAdmin, appearanceId, context.versionId)
        }
}
