package com.dsbuilder.frontend.cli.feature.components.presentation

import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.command.SuspendingCliktCommand as CliktCommand

/**
 * Command group `components`.
 */
internal class ComponentsCliCommand(
    pushCommand: ComponentsPushCliCommand,
    fetchCommand: ComponentsFetchCliCommand,
    generateCommand: ComponentsGenerateCliCommand,
    importApiCommand: ComponentsImportApiCliCommand,
) : CliktCommand(name = "components") {
    init {
        subcommands(pushCommand, fetchCommand, generateCommand, importApiCommand)
    }

    override fun help(context: Context): String = "Manage design system components."

    override suspend fun run(): Unit = Unit
}
