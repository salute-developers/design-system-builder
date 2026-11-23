package com.dsbuilder.frontend.cli

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/** Запускает CLI до завершения корутины и записи вывода Node.js. */
public fun main() {
    val process: dynamic = js("process")
    val args = (process.argv as Array<String>).drop(2)
    val scope = MainScope()
    var interrupted: Int? = null
    val handlers = mapOf("SIGINT" to 130, "SIGTERM" to 143, "SIGHUP" to 129).mapValues { (_, code) ->
        val handler: () -> Unit = {
            if (interrupted != null) process.exit(code)
            interrupted = code
            scope.cancel("Interrupted")
        }
        handler
    }
    handlers.forEach { (signal, handler) -> process.on(signal, handler) }
    scope.launch {
        try {
            process.exitCode = DsBuilderCli().executeInteractive(args)
        } catch (_: CancellationException) {
            process.exitCode = interrupted ?: 130
        } catch (error: Throwable) {
            process.stderr.write("${error.message ?: "CLI failed"}\n")
            process.exitCode = 1
        } finally {
            handlers.forEach { (signal, handler) -> process.removeListener(signal, handler) }
            scope.cancel()
        }
    }
}
