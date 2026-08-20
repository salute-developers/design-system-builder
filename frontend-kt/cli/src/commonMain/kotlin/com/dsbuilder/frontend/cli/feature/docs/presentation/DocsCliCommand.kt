package com.dsbuilder.frontend.cli.feature.docs.presentation

import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.subcommands

/**
 * Root CLI command для группы `docs`.
 */
internal class DocsCliCommand(
    private val initCommand: DocsInitCliCommand,
    private val generateCommand: DocsGenerateCliCommand,
    private val publishCommand: DocsPublishCliCommand,
) : CliktCommand(name = "docs") {
    init {
        subcommands(initCommand, generateCommand, publishCommand)
    }

    override fun run() {
        // This is a parent command — no direct action.
        // Subcommands handle their own logic.
    }
}
