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
    val cancel: () -> Unit = { scope.cancel("Interrupted") }
    process.on("SIGINT", cancel)
    scope.launch {
        try {
            process.exitCode = DsBuilderCli().executeInteractive(args)
        } catch (_: CancellationException) {
            process.exitCode = 130
        } catch (error: Throwable) {
            process.stderr.write("${error.message ?: "CLI failed"}\n")
            process.exitCode = 1
        } finally {
            process.removeListener("SIGINT", cancel)
            scope.cancel()
        }
    }
}
