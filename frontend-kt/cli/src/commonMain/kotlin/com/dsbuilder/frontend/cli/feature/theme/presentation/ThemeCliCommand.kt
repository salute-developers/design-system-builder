package com.dsbuilder.frontend.cli.feature.theme.presentation

import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.command.SuspendingCliktCommand as CliktCommand

/**
 * Command group `theme`.
 */
internal class ThemeCliCommand(
    fetchCommand: ThemeFetchCliCommand,
    generateCommand: ThemeGenerateCliCommand,
    aliasCommand: ThemeAliasCliCommand,
) : CliktCommand(name = "theme") {
    init {
        subcommands(fetchCommand, generateCommand, aliasCommand)
    }

    override fun help(context: Context): String = "Manage design system themes."

    override suspend fun run(): Unit = Unit
}
