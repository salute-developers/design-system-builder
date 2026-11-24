package com.dsbuilder.frontend.cli.feature.previewplugin.presentation

import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.command.SuspendingCliktCommand as CliktCommand

/**
 * Command group `preview-plugin`.
 */
internal class PreviewPluginCliCommand(
    publishCommand: PreviewPluginPublishCliCommand,
) : CliktCommand(name = "preview-plugin") {
    init {
        subcommands(publishCommand)
    }

    override fun help(context: Context): String = "Manage the Compose preview plugin builds of the backend."

    override suspend fun run(): Unit = Unit
}
