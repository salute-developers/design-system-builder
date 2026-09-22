package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.ProjectContext

/** Загружает исходный JSON legacy-конфигов, сохраняя неизвестные поля. */
internal fun interface ComponentConfigsSnapshotSource {
    suspend fun fetch(command: ExportComponentsCommand, designSystemName: String): ComponentConfigsSnapshotResult
}

internal sealed interface ComponentConfigsSnapshotResult {
    data class Loaded(val content: String) : ComponentConfigsSnapshotResult

    data class Failed(val message: String) : ComponentConfigsSnapshotResult
}

/** Записывает snapshot рядом с project config или в явный каталог `--to`. */
internal fun interface ComponentConfigsSnapshotWriter {
    fun write(
        context: ProjectContext,
        destination: ComponentDestination,
        content: String,
    ): ComponentPackageWriteResult
}
