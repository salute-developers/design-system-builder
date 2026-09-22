package com.dsbuilder.frontend.core.workspace

/**
 * Ошибка разбора `.env`; содержимое строки и значения не включаются в сообщение.
 * @property lineNumber номер некорректной строки.
 */
public class ProjectEnvParseException(public val lineNumber: Int) : IllegalArgumentException(
    "Invalid .env assignment at line $lineNumber.",
)

/** Разбирает данные `.env` без выполнения shell-синтаксиса и интерполяции. */
public class ProjectEnvParser {
    /** Возвращает последний присвоенный value для каждого корректного имени. */
    public fun parse(content: String): Map<String, String> {
        val values = mutableMapOf<String, String>()
        content.lineSequence().forEachIndexed { index, rawLine ->
            val line = rawLine.trim().removeSuffix("\r")
            if (line.isEmpty() || line.startsWith('#')) return@forEachIndexed
            val assignment = if (line.startsWith("export ")) line.removePrefix("export ").trimStart() else line
            val separator = assignment.indexOf('=')
            if (separator < 1) throw ProjectEnvParseException(index + 1)
            val name = assignment.substring(0, separator).trim()
            if (!name.matches(Regex("[A-Za-z_][A-Za-z0-9_]*"))) {
                throw ProjectEnvParseException(index + 1)
            }
            val source = assignment.substring(separator + 1).trimStart()
            values[name] = parseValue(source, index + 1)
        }
        return values
    }

    private fun parseValue(source: String, lineNumber: Int): String {
        if (source.isEmpty()) return ""
        if (source.first() == '\'' || source.first() == '"') {
            val quote = source.first()
            val end = source.indexOf(quote, startIndex = 1)
            if (end < 0 || source.substring(end + 1).trim().let { it.isNotEmpty() && !it.startsWith('#') }) {
                throw ProjectEnvParseException(lineNumber)
            }
            return source.substring(1, end)
        }
        val comment = source.indexOf('#').takeIf { it > 0 && source[it - 1].isWhitespace() }
        val value = if (comment == null) source else source.substring(0, comment)
        return value.trimEnd()
    }
}
