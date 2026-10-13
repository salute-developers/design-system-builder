package com.dsbuilder.frontend.cli.feature.components.presentation

/** Описание `--platform` у `components push` и `components fetch`. */
internal const val PLATFORM_COMPONENTS_HELP: String =
    "Platform of the components. Taken from .sdds/config.json when it declares one platform; " +
        "required when it declares several."
