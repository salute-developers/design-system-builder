package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException
import com.dsbuilder.frontend.core.process.ProcessRequest
import com.dsbuilder.frontend.core.process.ProcessResult
import com.dsbuilder.frontend.core.process.ProcessRunner
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.ObjCObjectVar
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.readBytes
import kotlinx.cinterop.value
import platform.Foundation.NSError
import platform.Foundation.NSPipe
import platform.Foundation.NSProcessInfo
import platform.Foundation.NSTask
import platform.Foundation.NSTaskTerminationReasonUncaughtSignal
import platform.Foundation.NSURL
import platform.Foundation.readDataToEndOfFile
import platform.Foundation.waitUntilExit

/**
 * Запуск процессов через `NSTask`.
 *
 * `posix_spawn` в биндингах Kotlin/Native для macOS отсутствует, а `fork` небезопасен для runtime.
 * В режиме наследования stdio дочерний процесс пишет прямо в терминал; в режиме захвата stdout и
 * stderr направляются в один pipe и читаются до EOF одним потоком — так исключён deadlock
 * на заполненном буфере.
 *
 * `standardInput` дочернего процесса в обоих режимах — пустой `NSPipe`, а не унаследованный терминал,
 * даже когда stdout/stderr наследуются для потокового вывода долгих сборок (Gradle, xcodebuild):
 * некоторые из этих инструментов всё равно трогают stdin при инициализации консоли. Если оставить им
 * терминал родителя, а процесс окажется вне foreground process group терминала (реальный сценарий при
 * запуске из интерактивной оболочки — таймингово нестабильный, отсюда и "иногда" воспроизводится),
 * ядро присылает `SIGTTIN` и стопит процесс — это выглядит как зависание без единой строчки вывода
 * (или зависание сразу после последней строчки), хотя на самом деле процесс просто ждёт ввода,
 * который никогда не придёт.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
internal object MacosProcessRunner : ProcessRunner {
    private const val SIGNAL_EXIT_CODE_BASE = 128

    override fun run(request: ProcessRequest): ProcessResult {
        val task = NSTask()
        task.executableURL = NSURL.fileURLWithPath(request.executable)
        task.arguments = request.args
        task.currentDirectoryURL = NSURL.fileURLWithPath(request.workingDirectory, isDirectory = true)
        task.environment = mergedEnvironment(request.environment)
        task.standardInput = NSPipe()

        val pipe = if (request.inheritStdio) {
            null
        } else {
            NSPipe().also {
                task.standardOutput = it
                task.standardError = it
            }
        }

        memScoped {
            val error = alloc<ObjCObjectVar<NSError?>>()
            if (!task.launchAndReturnError(error.ptr)) {
                val reason = error.value?.localizedDescription ?: "unknown error"
                throw ProcessLaunchException("Cannot start process ${request.executable}: $reason")
            }
        }

        val output = pipe?.let(::readToEnd).orEmpty()
        task.waitUntilExit()
        val status = task.terminationStatus
        val exitCode = if (task.terminationReason == NSTaskTerminationReasonUncaughtSignal) {
            SIGNAL_EXIT_CODE_BASE + status
        } else {
            status
        }

        return ProcessResult(exitCode = exitCode, output = output)
    }

    /** Окружение родителя плюс переменные запроса: одноимённые перекрываются запросом. */
    private fun mergedEnvironment(extra: Map<String, String>): Map<Any?, Any?> {
        val environment: MutableMap<Any?, Any?> = NSProcessInfo.processInfo.environment.toMutableMap()
        environment.putAll(extra)

        return environment
    }

    private fun readToEnd(pipe: NSPipe): String {
        val data = pipe.fileHandleForReading.readDataToEndOfFile()
        val length = data.length.toInt()
        if (length == 0) return ""

        return data.bytes?.readBytes(length)?.decodeToString().orEmpty()
    }
}
