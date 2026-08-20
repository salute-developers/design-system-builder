package com.dsbuilder.frontend.cli.feature.components.presentation

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands

/**
 * Command group `components`.
 */
internal class ComponentsCliCommand(
    pushCommand: ComponentsPushCliCommand,
) : CliktCommand(name = "components") {
    init {
        subcommands(pushCommand)
    }

    override fun help(context: Context): String = "Manage design system components."

    override fun run(): Unit = Unit
}
