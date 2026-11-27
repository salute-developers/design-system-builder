package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.AppearanceEditorModel
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
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
        policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
            transactions.readOnly(
                context,
                ModelReadTarget(
                    ModelReadTarget.Kind.APPEARANCE,
                    appearanceId,
                ),
            ) { selected ->
                repository.model(selected.projectId, selected.globalAdmin, appearanceId, selected.versionId)
                    ?.let { DsResult.Success(it) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
