@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package com.dsbuilder.frontend.cli

import kotlinx.cinterop.UShortVar
import kotlinx.cinterop.allocArray
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.toKStringFromUtf16
import platform.windows.GetEnvironmentVariableW

/** Читает Unicode-переменные окружения без преобразования через системную code page. */
internal object WindowsEnvironment {
    fun get(name: String): String? = memScoped {
        val size = GetEnvironmentVariableW(name, null, 0u)
        if (size == 0u) return@memScoped null
        val buffer = allocArray<UShortVar>(size.toInt())
        if (GetEnvironmentVariableW(name, buffer, size) == 0u) return@memScoped null
        buffer.toKStringFromUtf16()
    }
}
