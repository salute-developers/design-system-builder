package com.dsbuilder.frontend.cli.presentation

import com.dsbuilder.frontend.cli.VERSION
import com.github.ajalt.clikt.core.CliktCommand
import com.github.ajalt.clikt.core.Context
import com.github.ajalt.clikt.core.subcommands
import com.github.ajalt.clikt.parameters.options.versionOption

/**
 * Корневая Clikt-команда `dsbuilder`.
 */
public class RootCliCommand(
    cliktSubcommands: List<CliktCommand>,
) : CliktCommand(name = "dsbuilder") {
    init {
        versionOption(VERSION, names = setOf("-v", "--version"))
        subcommands(cliktSubcommands)
    }

    override fun help(context: Context): String =
        "DS Builder CLI. Analytics sends command/tool names, outcomes, version, OS and an installation ID " +
            "to Yandex Metrica. Disable with DSBUILDER_ANALYTICS_DISABLED=1 or DO_NOT_TRACK=1. See docs/analytics.md."

    override fun run(): Unit = Unit
}
