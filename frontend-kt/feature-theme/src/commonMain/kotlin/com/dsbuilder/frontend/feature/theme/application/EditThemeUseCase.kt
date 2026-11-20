package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.application.DraftOperationRunner
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.HttpMutationResult

internal fun interface ThemeEditRemoteSource {
    suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: ThemeEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult
}

/** Передаёт серверу одну семейную или специализированную операцию темы. */
public class EditThemeUseCase internal constructor(
    resolver: RuntimeRequestResolver,
    private val remote: ThemeEditRemoteSource,
) {
    private val runner = DraftOperationRunner(resolver)

    /** Проверяет полноту выбранных членов семейства до отправки единственного PUT. */
    public suspend fun execute(
        command: ThemeEditCommand,
        options: DraftEditOptions,
        request: RuntimeRequest = RuntimeRequest(),
    ): DraftOperationResult {
        val error = themeCommandError(command)
        if (error != null) return DraftOperationResult.Failed("VALIDATION_FAILED", error)
        return runner.mutate(options, request) { remote.edit(it, command, options) }
    }
}

private fun themeCommandError(command: ThemeEditCommand): String? = when (command) {
    is ThemeEditCommand.UpdateFamily -> familyUpdateError(command.input.members)
    is ThemeEditCommand.CreateGroup -> if (command.input.kind != "color") "Only color groups are supported." else null
    else -> null
}

private fun familyUpdateError(members: List<ColorFamilyMemberUpdate>): String? {
    if (members.isEmpty() || members.map { it.tokenId }.distinct().size != members.size) {
        return "Supply distinct selected family members."
    }
    val pairs = setOf("web/light", "web/dark", "ios/light", "ios/dark", "android/light", "android/dark")
    val invalid = members.any { member ->
        member.values.size != pairs.size || member.values.map { "${it.platform}/${it.mode}" }.toSet() != pairs ||
            member.values.any { it.baseRevision == null || it.baseRevision < 0 }
    }
    return if (invalid) {
        "Supply all six unique platform/mode pairs with baseRevision. " +
            "Use token_edit_data_get or a point edit."
    } else {
        null
    }
}
