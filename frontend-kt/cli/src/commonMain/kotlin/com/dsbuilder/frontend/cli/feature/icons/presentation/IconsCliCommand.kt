package com.dsbuilder.frontend.cli.feature.icons.presentation

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands

/**
 * Command group `icons`.
 */
internal class IconsCliCommand(
    publishCommand: IconsPublishCliCommand,
) : CliktCommand(name = "icons") {
    init {
        subcommands(publishCommand)
    }

    override fun help(context: Context): String = "Manage the icon catalog of the backend."

    override fun run(): Unit = Unit
}
