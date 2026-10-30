package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.ComponentEditorBundle
import com.dsbuilder.ds.components.domain.ComponentEditorPlatform
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/**
 * Читает данные одного компонента для редактора одним запросом.
 *
 * Требует `components:variations:read`; `versionId` контекста выбирает опубликованную версию. Недоступная
 * дизайн-система, непривязанный компонент или компонент другой платформы скрываются как `NotFound`.
 */
class GetComponentEditorBundleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: ComponentEditorBundleRepository,
) {
    /** Выполняет сценарий в одной read-only транзакции. */
    suspend fun execute(
        context: DsRequestContext,
        designSystemId: UUID,
        componentId: UUID,
        platform: ComponentEditorPlatform,
    ): DsResult<ComponentEditorBundle> = policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
        transactions.readOnly(context) {
            val attempt = repository.load(
                context.projectId,
                context.principal.systemAdmin,
                designSystemId,
                componentId,
                platform,
            )
            when (attempt) {
                is ComponentEditorBundleRepository.LoadAttempt.Success -> {
                    if (attempt.value.component.platform == platform.wireValue) {
                        DsResult.Success(attempt.value)
                    } else {
                        DsResult.Failure(DsFailure.NotFound)
                    }
                }
                ComponentEditorBundleRepository.LoadAttempt.NotFound -> DsResult.Failure(DsFailure.NotFound)
                is ComponentEditorBundleRepository.LoadAttempt.Failed ->
                    DsResult.Failure(DsFailure.Unprocessable("Export failed", attempt.reason))
            }
        }
    }
}
