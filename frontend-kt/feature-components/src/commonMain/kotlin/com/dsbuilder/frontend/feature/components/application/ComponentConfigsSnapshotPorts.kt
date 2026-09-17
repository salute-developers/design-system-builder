package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.ProjectContext

/** Загружает исходный JSON legacy-конфигов, сохраняя неизвестные поля. */
internal fun interface ComponentConfigsSnapshotSource {
    fun fetch(command: ExportComponentsCommand, designSystemName: String): ComponentConfigsSnapshotResult
}

internal sealed interface ComponentConfigsSnapshotResult {
    data class Loaded(val content: String) : ComponentConfigsSnapshotResult

    data class Failed(val message: String) : ComponentConfigsSnapshotResult
}

/** Записывает snapshot рядом с project config, независимо от директории пакета `--to`. */
internal fun interface ComponentConfigsSnapshotWriter {
    fun write(context: ProjectContext, content: String): ComponentPackageWriteResult
}
