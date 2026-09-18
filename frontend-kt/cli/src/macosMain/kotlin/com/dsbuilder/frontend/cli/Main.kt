package com.dsbuilder.frontend.cli

import kotlin.system.exitProcess

/**
 * Запускает macOS entrypoint для CLI-приложения `dsbuilder`.
 */
public fun main(args: Array<String>) {
    exitProcess(DsBuilderCli().executeInteractive(args.toList()))
}
