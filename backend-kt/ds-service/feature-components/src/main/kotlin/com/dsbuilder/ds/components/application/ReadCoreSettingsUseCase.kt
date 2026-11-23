package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner

/** Настройки доступны с правом чтения ДС, исторический выбор разрешается в той же транзакции. */
class ReadCoreSettingsUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val checker: CompatibilityChecker,
) {
    /** Возвращает сохранённые привязки вместе с актуальным отчётом для формы настроек. */
    suspend fun execute(context: DsRequestContext): DsResult<CoreSettingsSnapshot> {
        val id = context.designSystemId ?: return DsResult.Failure(DsFailure.NotFound)
        return policy.read(context, "design-systems:read") {
            transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id)) { resolved ->
                DsResult.Success(CoreSettingsSnapshot.from(checker.check(context.projectId, id, resolved.versionId)))
            }
        }
    }
}
