package com.dsbuilder.frontend.cli

import com.dsbuilder.frontend.core.process.isAbsolutePath

/** Normalizes a Windows path without filesystem access, retaining drive and UNC roots. */
internal fun normalizedAbsoluteWindowsPath(path: String, currentDirectory: String): String {
    val absolute = when {
        path.startsWith("/") && !path.startsWith("//") -> currentDirectory.take(2) + path
        isAbsolutePath(path) -> path
        else -> "${currentDirectory.trimEnd('\\', '/')}\\$path"
    }
    val normalized = absolute.replace('/', '\\')
    val root = when {
        normalized.startsWith("\\\\") -> normalized.drop(2).split('\\').take(2).joinToString("\\", prefix = "\\\\")
        else -> normalized.take(3)
    }
    val parts = mutableListOf<String>()
    normalized.removePrefix(root).split('\\').forEach { part ->
        when (part) {
            "", "." -> Unit
            ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.lastIndex)
            else -> parts += part
        }
    }
    return if (parts.isEmpty()) root else "${root.trimEnd('\\')}\\${parts.joinToString("\\")}"
}
