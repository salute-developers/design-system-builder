@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli.feature.init.presentation

import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.windows.CONSOLE_CURSOR_INFO
import platform.windows.DWORDVar
import platform.windows.GetConsoleCursorInfo
import platform.windows.GetConsoleMode
import platform.windows.GetStdHandle
import platform.windows.STD_INPUT_HANDLE
import platform.windows.STD_OUTPUT_HANDLE
import platform.windows.SetConsoleCursorInfo
import platform.windows.SetConsoleMode

internal actual fun preserveInitConsole(): AutoCloseable = memScoped {
    val input = GetStdHandle(STD_INPUT_HANDLE)
    val output = GetStdHandle(STD_OUTPUT_HANDLE)
    val inputMode = alloc<DWORDVar>()
    val outputMode = alloc<DWORDVar>()
    val cursor = alloc<CONSOLE_CURSOR_INFO>()
    val hasInput = GetConsoleMode(input, inputMode.ptr) != 0
    val hasOutput = GetConsoleMode(output, outputMode.ptr) != 0
    val hasCursor = GetConsoleCursorInfo(output, cursor.ptr) != 0
    val originalInput = if (hasInput) inputMode.value else 0u
    val originalOutput = if (hasOutput) outputMode.value else 0u
    val originalSize = if (hasCursor) cursor.dwSize else 0u
    val originalVisible = if (hasCursor) cursor.bVisible else 0
    AutoCloseable {
        if (hasInput) SetConsoleMode(input, originalInput)
        if (hasOutput) SetConsoleMode(output, originalOutput)
        if (hasCursor) {
            memScoped {
                val restored = alloc<CONSOLE_CURSOR_INFO>()
                restored.dwSize = originalSize
                restored.bVisible = originalVisible
                SetConsoleCursorInfo(output, restored.ptr)
            }
        }
    }
}
