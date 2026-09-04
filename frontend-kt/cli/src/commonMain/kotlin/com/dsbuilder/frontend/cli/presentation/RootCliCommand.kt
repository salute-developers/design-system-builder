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

    override fun help(context: Context): String = "DS Builder CLI."

    override fun run(): Unit = Unit
}
