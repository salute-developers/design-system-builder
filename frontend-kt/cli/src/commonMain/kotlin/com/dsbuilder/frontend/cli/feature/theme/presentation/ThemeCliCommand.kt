package com.dsbuilder.frontend.cli.feature.theme.presentation

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands

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

    override fun run(): Unit = Unit
}
