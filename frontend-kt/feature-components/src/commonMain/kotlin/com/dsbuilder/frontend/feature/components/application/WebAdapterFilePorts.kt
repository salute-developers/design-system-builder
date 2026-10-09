package com.dsbuilder.frontend.feature.components.application

import com.dsbuilder.frontend.core.domain.ProjectContext

/**
 * Загружает web-адаптер: шаблоны web-параметров, compose-связи, имена и описания компонентов.
 *
 * Временное решение для локальной web-генерации: ответ не разбирается в модель пакета и не входит
 * в план записи, а сохраняется в `.sdds/web/web-adapter.json` как есть. Загружается только для платформы React, выбранной как у команд генерации. Удалить
 * решение — значит удалить эти порты, их реализации и ручку backend.
 */
internal fun interface WebAdapterFileSource {
    suspend fun fetch(command: ExportComponentsCommand): WebAdapterFileResult
}

internal sealed interface WebAdapterFileResult {
    /**
     * @property content содержимое `web-adapter.json`.
     */
    data class Loaded(val content: String) : WebAdapterFileResult

    data class Failed(val message: String) : WebAdapterFileResult
}

/** Записывает web-адаптер в `web/` рядом с project config или в явном каталоге `--to`. */
internal fun interface WebAdapterFileWriter {
    fun write(
        context: ProjectContext,
        destination: ComponentDestination,
        adapter: WebAdapterFileResult.Loaded,
    ): ComponentPackageWriteResult
}
