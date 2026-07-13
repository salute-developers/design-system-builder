package com.dsbuilder.frontend.cli

import kotlin.system.exitProcess

/**
 * Запускает macOS entrypoint для CLI-приложения `dsbuilder`.
 */
public fun main(args: Array<String>) {
    val result = DsBuilderCli().execute(args.toList())

    println(result.output)
    exitProcess(result.exitCode)
}
