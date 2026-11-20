package com.dsbuilder.frontend.cli

import kotlinx.coroutines.runBlocking
import kotlin.system.exitProcess

/**
 * Запускает JVM entrypoint для CLI-приложения `dsbuilder`.
 */
public fun main(args: Array<String>) {
    val operation = kotlinx.coroutines.Job()
    val shutdown = Thread {
        operation.cancel()
        runBlocking { kotlinx.coroutines.withTimeoutOrNull(7000) { operation.join() } }
    }
    Runtime.getRuntime().addShutdownHook(shutdown)
    val code = try {
        runBlocking(operation) { DsBuilderCli().executeInteractive(args.toList()) }
    } catch (_: kotlinx.coroutines.CancellationException) {
        130
    } finally {
        operation.complete()
        try { Runtime.getRuntime().removeShutdownHook(shutdown) } catch (_: IllegalStateException) {
            // JVM shutdown is already waiting for the cancellation hook.
        }
    }
    exitProcess(code)
}
