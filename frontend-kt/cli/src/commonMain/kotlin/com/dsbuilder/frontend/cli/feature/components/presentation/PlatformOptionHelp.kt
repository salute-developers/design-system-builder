package com.dsbuilder.frontend.cli.feature.components.presentation

/** Описание `--platform` у `components push` и `components fetch`. */
internal const val PLATFORM_COMPONENTS_HELP: String =
    "Platform of the components. Taken from .sdds/config.json when it declares one platform; " +
        "required when it declares several."

/**
 * Описание `--platform` у `components import-api`.
 *
 * Перечень платформ приходит из набора нормализаторов, а не записан здесь: справка и отказ команды
 * должны говорить одно и то же.
 */
internal fun platformImportApiHelp(supported: List<String>): String =
    "Platform of the API meta file. Supported: ${supported.joinToString()}."
