package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.ProcessLaunchException

/** Windows argv quoting for direct CreateProcessW calls. */
internal fun windowsExecutableCommandLine(executable: String, args: List<String>): String =
    (listOf(executable) + args).joinToString(" ") { quoteWindowsArgument(it) }

/** Command interpreter invocation for a .cmd or .bat tool. */
internal fun windowsBatchCommandLine(script: String, args: List<String>): String {
    val tokens = (listOf(script) + args).joinToString(" ") { quoteCmdArgument(it) }
    return "cmd.exe /d /v:off /s /c \"$tokens\""
}

private fun quoteCmdArgument(value: String): String {
    if (value.any { it.code < 32 || it == '\u007f' || it in "\"%^!" }) {
        throw ProcessLaunchException("Windows batch arguments cannot contain quotes, expansion or control characters")
    }
    return "\"$value\""
}

private fun quoteWindowsArgument(value: String): String {
    if (value.isEmpty()) return "\"\""
    if (value.none { it.isWhitespace() || it == '"' }) return value
    val out = StringBuilder("\"")
    var slashes = 0
    for (char in value) {
        when (char) {
            '\\' -> slashes++
            '"' -> {
                repeat(slashes * 2 + 1) { out.append('\\') }
                out.append('"')
                slashes = 0
            }
            else -> {
                repeat(slashes) { out.append('\\') }
                out.append(char)
                slashes = 0
            }
        }
    }
    repeat(slashes * 2) { out.append('\\') }
    return out.append('"').toString()
}
