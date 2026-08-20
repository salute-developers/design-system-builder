package com.dsbuilder.frontend.cli.feature.components.application

import com.dsbuilder.frontend.cli.core.domain.ProjectContext
import com.dsbuilder.frontend.cli.feature.components.domain.ComponentPackageResult

/**
 * Откуда брать пакет конфигураций компонентов.
 *
 * @property directory директория, заданная `--from`, либо `null` для `.sdds/components`.
 */
internal data class ComponentSource(
    val directory: String? = null,
)

/**
 * Port чтения пакета конфигураций компонентов.
 */
internal fun interface ComponentPackageLoader {
    /**
     * Читает пакет из указанной директории.
     */
    fun load(
        source: ComponentSource,
        context: ProjectContext,
    ): ComponentPackageResult
}
