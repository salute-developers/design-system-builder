package com.dsbuilder.frontend.cli.feature.ds.presentation

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands

/**
 * Presentation command для `dsbuilder ds`: дизайн-система целиком — тема и компоненты.
 */
internal class DsCliCommand(
    fetchCommand: DsFetchCliCommand,
    generateCommand: DsGenerateCliCommand,
) : CliktCommand(name = "ds") {
    init {
        subcommands(fetchCommand, generateCommand)
    }

    override fun help(context: Context): String = "Fetch or generate the whole design system: theme and components."

    override fun run(): Unit = Unit
}
