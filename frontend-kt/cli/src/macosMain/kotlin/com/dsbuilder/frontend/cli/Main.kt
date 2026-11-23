@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.cli.macosprocess.dsb_begin_interrupt
import com.dsbuilder.frontend.cli.macosprocess.dsb_end_interrupt
import com.dsbuilder.frontend.cli.macosprocess.dsb_take_interrupt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlin.system.exitProcess

/**
 * Запускает macOS entrypoint для CLI-приложения `dsbuilder`.
 */
public fun main(args: Array<String>) {
    val code = try {
        runBlocking {
            check(dsb_begin_interrupt() == 0) { "Cannot install CLI interrupt handler" }
            val command = async { DsBuilderCli().executeInteractive(args.toList()) }
            val interrupts = launch(Dispatchers.Default) {
                while (isActive) {
                    if (dsb_take_interrupt() != 0) {
                        command.cancel()
                        break
                    }
                    delay(20)
                }
            }
            try { command.await() } finally {
                interrupts.cancel()
                dsb_end_interrupt()
            }
        }
    } catch (_: kotlinx.coroutines.CancellationException) {
        130
    }
    exitProcess(code)
}
