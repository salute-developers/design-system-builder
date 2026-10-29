package com.dsbuilder.frontend.cli

import kotlin.system.exitProcess

/** Запускает Windows CLI и встроенный MCP-сервер. */
public fun main(args: Array<String>) {
    exitProcess(DsBuilderCli().executeInteractive(args.toList()))
}
