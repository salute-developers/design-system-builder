package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.DraftOperationResult
import com.dsbuilder.frontend.core.application.DraftOperationRunner
import com.dsbuilder.frontend.core.application.RuntimeRequest
import com.dsbuilder.frontend.core.application.RuntimeRequestResolver
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.HttpMutationResult

internal interface ComponentEditRemoteSource {
    suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: ComponentEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult
    suspend fun read(runtime: RuntimeResolution.Resolved, appearanceId: String): HttpMutationResult
}

/** Делегирует предметные правила компонентов серверу в неизменном контексте черновика. */
public class EditComponentUseCase internal constructor(
    resolver: RuntimeRequestResolver,
    private val remote: ComponentEditRemoteSource,
) {
    private val runner = DraftOperationRunner(resolver)

    /** Передаёт одну типизированную команду с исходными редакцией и ключом. */
    public suspend fun execute(
        command: ComponentEditCommand,
        options: DraftEditOptions,
        request: RuntimeRequest = RuntimeRequest(),
    ): DraftOperationResult =
        runner.mutate(options, request) { remote.edit(it, command, options) }

    /** Читает исходную модель конфигурации с предметными редакциями. */
    public suspend fun read(
        appearanceId: String,
        version: String? = null,
        request: RuntimeRequest = RuntimeRequest(),
    ): DraftOperationResult =
        runner.read(version, request) { remote.read(it, appearanceId) }
}
