package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.application.valueOr

/** Атомарное сохранение выбранного Core одной платформы. */
class SelectCoreReleaseUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: CoreSettingsRepository,
    private val checker: CompatibilityChecker,
) {
    /** Даже несовместимый Core сохраняется: значения остаются доступны для исправления. */
    suspend fun execute(context: DsRequestContext, command: SelectCoreRelease): DsResult<CoreSettingsSnapshot> {
        val id = context.designSystemId ?: return DsResult.Failure(DsFailure.NotFound)
        if (!valid(command.platform, command.channel) || !validSelection(command)) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_body"))
        }
        return policy.read(context, "design-systems:write") {
            transactions.required(context) {
                repository.select(context, command).valueOr { return@required it }
                DsResult.Success(CoreSettingsSnapshot.from(checker.check(context.projectId, id, null)))
            }
        }
    }

    private fun validSelection(command: SelectCoreRelease): Boolean =
        command.expectedCoreSelectionRevision >= 0 && command.selectionMode in setOf("pinned", "latest") &&
            (command.selectionMode != "pinned" || command.releaseId != null)

    private fun valid(platform: String, channel: String): Boolean =
        platform in setOf("compose", "web", "xml", "ios") && channel in setOf("stable", "dev")
}
