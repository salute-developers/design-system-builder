package com.dsbuilder.frontend.feature.theme.application

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.application.DraftOperationRunner
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.HttpMutationResult

internal fun interface TokenEditRemoteSource {
    suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: TokenEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult
}

/** Разрешает runtime один раз и направляет точечную запись в черновик. */
public class EditTokenUseCase internal constructor(
    runtimeResolver: RuntimeRequestResolver,
    private val remote: TokenEditRemoteSource,
) {
    private val runner = DraftOperationRunner(runtimeResolver)

    /** Передаёт исходные ключ и редакцию без предварительного GET и автоматических повторов. */
    public suspend fun execute(
        command: TokenEditCommand,
        options: DraftEditOptions,
        request: RuntimeRequest = RuntimeRequest(),
    ): DraftOperationResult = runner.mutate(options, request) { remote.edit(it, command, options) }
}
