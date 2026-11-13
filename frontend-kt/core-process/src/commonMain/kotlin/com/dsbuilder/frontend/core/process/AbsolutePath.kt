package com.dsbuilder.frontend.core.process

/** Общая проверка абсолютного пути Unix, Windows drive или UNC. */
public fun isAbsolutePath(path: String): Boolean =
    path.startsWith('/') ||
        (path.length >= 3 && path[0].isLetter() && path[1] == ':' && path[2].isPathSeparator()) ||
        (
            path.startsWith("\\\\") && path.drop(2).split('\\').let { parts ->
                parts.size >= 2 && parts[0].isNotEmpty() && parts[1].isNotEmpty()
            }
            )

/** Родитель абсолютного пути с сохранением корня тома или UNC-ресурса. */
public fun parentOfAbsolutePath(path: String): String? {
    if (!isAbsolutePath(path)) return null
    val normalized = path.trimEnd('/', '\\')
    val rootLength = rootLength(path, normalized)
    if (normalized.length <= rootLength) return null
    val lastSeparator = normalized.lastIndexOfAny(charArrayOf('/', '\\'))
    return if (lastSeparator < rootLength) {
        path.take(rootLength)
    } else {
        normalized.take(lastSeparator)
    }
}

private fun rootLength(path: String, normalized: String): Int =
    when {
        path.startsWith("\\\\") -> {
            val serverEnd = path.indexOf('\\', 2)
            path.indexOf('\\', serverEnd + 1).takeIf { it >= 0 } ?: normalized.length
        }
        path.length >= 3 && path[1] == ':' -> 3
        else -> 1
    }

private fun Char.isPathSeparator(): Boolean = this == '/' || this == '\\'
