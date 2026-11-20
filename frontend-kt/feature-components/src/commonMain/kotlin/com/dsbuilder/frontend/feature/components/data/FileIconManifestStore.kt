package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.workspace.WorkspaceFileSystem
import com.dsbuilder.frontend.feature.components.application.IconManifestReadResult
import com.dsbuilder.frontend.feature.components.application.IconManifestStore
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifest
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestEntry
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestRules
import com.dsbuilder.frontend.feature.components.domain.icons.IconManifestSource
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Читает источник иконок с локального диска: каталог пакета `@salutejs/sdds-icons` или готовый манифест.
 *
 * Имя иконки — имя файла без `.svg`; размер — подкаталог `svg/<размер>`. Категория и синонимы берутся из элемента
 * `<metadata>` самого SVG (JSON с XML-сущностями), по размеру `24`, а при его отсутствии по первому найденному.
 */
internal class FileIconManifestStore(
    private val fileSystem: WorkspaceFileSystem,
) : IconManifestStore {
    @Suppress("ReturnCount")
    override fun fromDirectory(path: String, packageVersion: String?): IconManifestReadResult {
        val root = fileSystem.absolutePath(path)
        if (!fileSystem.exists(root)) return failed("icons directory '$root' does not exist.")
        if (!fileSystem.isDirectory(root)) return failed("'$root' is not a directory.")
        val svgRoot = fileSystem.resolve(root, "svg")
        val sizeDirectories = IconManifestRules.SIZES
            .map { it to fileSystem.resolve(svgRoot, it.toString()) }
            .filter { fileSystem.isDirectory(it.second) }
        if (sizeDirectories.isEmpty()) {
            return failed("'$root' contains none of svg/16, svg/24, svg/36; pass the root of @salutejs/sdds-icons.")
        }
        val files = mutableMapOf<String, MutableMap<Int, String>>()
        for ((size, directory) in sizeDirectories) {
            val problem = collect(size, directory, files)
            if (problem != null) return failed(problem)
        }
        if (files.isEmpty()) return failed("no SVG files found in the size directories of '$root'.")
        val warnings = mutableListOf<String>()
        val icons = files.entries.sortedBy { it.key }
            .map { (name, sizes) -> entry(name, sizes.toList().sortedBy { it.first }.toMap(), warnings) }
        val version = packageVersion ?: packageJsonVersion(root) ?: IconManifestRules.UNKNOWN_VERSION
        val source = IconManifestSource(IconManifestRules.PACKAGE_NAME, version)
        return IconManifestReadResult.Read(IconManifest(source, icons), warnings)
    }

    /** Читает SVG одного размера в [files]; возвращает описание ошибки или `null`. */
    private fun collect(size: Int, directory: String, files: MutableMap<String, MutableMap<Int, String>>): String? {
        val candidates = fileSystem.listFiles(directory).sorted()
            .filter { !fileSystem.isDirectory(it) }
            .mapNotNull { file -> svgName(file)?.let { file to it } }
        for ((file, name) in candidates) {
            val bytes = if (IconManifestRules.NAME.matches(name)) fileSystem.readBytes(file) else null
            val problem = when {
                bytes == null -> "'$file' is not a valid icon name."
                bytes.size > IconManifestRules.MAX_SVG_BYTES ->
                    "'$file' is ${bytes.size} bytes, larger than ${IconManifestRules.MAX_SVG_BYTES}."
                else -> null
            }
            if (problem != null) return problem
            files.getOrPut(name) { mutableMapOf() }[size] = requireNotNull(bytes).decodeToString()
        }
        return null
    }

    @Suppress("ReturnCount")
    override fun fromManifest(path: String): IconManifestReadResult {
        val file = fileSystem.absolutePath(path)
        if (!fileSystem.exists(file) || fileSystem.isDirectory(file)) return failed("manifest '$file' does not exist.")
        val text = try {
            fileSystem.readText(file)
        } catch (_: Exception) {
            return failed("cannot read manifest '$file'.")
        }
        return when (val decoded = IconManifestJson.decode(text)) {
            is IconManifestDecoding.Invalid -> failed("manifest '$file' is not usable: ${decoded.reason}.")
            is IconManifestDecoding.Valid -> IconManifestReadResult.Read(decoded.manifest, emptyList())
        }
    }

    @Suppress("TooGenericExceptionCaught")
    override fun write(path: String, manifest: IconManifest): String? {
        val file = fileSystem.absolutePath(path)
        return try {
            fileSystem.writeText(file, IconManifestJson.encode(manifest))
            null
        } catch (exception: Exception) {
            "Error: cannot write manifest '$file': ${exception.message?.lineSequence()?.firstOrNull().orEmpty()}"
        }
    }

    private fun failed(message: String) = IconManifestReadResult.Failed("Error: $message")

    /** Имя иконки по пути файла `*.svg` или `null`, если файл не SVG. */
    private fun svgName(path: String): String? =
        path.substringAfterLast('/').substringAfterLast('\\').takeIf { it.endsWith(SVG_EXTENSION) }
            ?.removeSuffix(SVG_EXTENSION)?.takeIf { it.isNotEmpty() }

    private fun entry(name: String, sizes: Map<Int, String>, warnings: MutableList<String>): IconManifestEntry {
        val missing = IconManifestRules.SIZES.filter { it !in sizes }
        if (missing.isNotEmpty()) warnings += "$name has no size ${missing.joinToString(", ")}."
        val baseSize = if (BASE_SIZE in sizes) BASE_SIZE else sizes.keys.first()
        val metadata = sizes.mapValues { (_, svg) -> IconSvgMetadata.parse(svg) }
        val base = metadata.getValue(baseSize)
        if (base == null) {
            warnings += "$name has no readable <metadata> in size $baseSize: no category and aliases."
        } else if (metadata.any { (_, other) -> other != null && other != base }) {
            warnings += "$name has different <metadata> between sizes: size $baseSize is used."
        }
        return IconManifestEntry(name, base?.category, base?.aliases.orEmpty(), sizes)
    }

    private fun packageJsonVersion(root: String): String? {
        val file = fileSystem.resolve(root, "package.json")
        if (!fileSystem.exists(file)) return null
        val text = try {
            fileSystem.readText(file)
        } catch (_: Exception) {
            return null
        }
        val version = (
            (runCatching { Json.parseToJsonElement(text) }.getOrNull() as? JsonObject)?.get("version")
                as? JsonPrimitive
            )?.takeIf { it.isString }?.content
        return version?.takeIf { it.isNotBlank() }
    }

    private companion object {
        const val SVG_EXTENSION = ".svg"
        const val BASE_SIZE = 24
    }
}

/** Категория и синонимы из элемента `<metadata>` SVG. */
internal data class IconSvgMetadata(val category: String?, val aliases: List<String>) {
    /** Разбор `<metadata>`; без `Regex`, потому что цель JS не поддерживает его полный набор. */
    companion object {
        private const val OPEN = "<metadata"
        private const val CLOSE = "</metadata>"
        private const val CDATA_OPEN = "<![CDATA["
        private const val CDATA_CLOSE = "]]>"

        /** Возвращает метаданные или `null`, если элемента нет или его содержимое не разбирается. */
        fun parse(svg: String): IconSvgMetadata? {
            val raw = content(svg) ?: return null
            val text = if (raw.startsWith(CDATA_OPEN) && raw.endsWith(CDATA_CLOSE)) {
                raw.removePrefix(CDATA_OPEN).removeSuffix(CDATA_CLOSE)
            } else {
                raw
            }
            val root = runCatching { Json.parseToJsonElement(text) }.getOrNull() as? JsonObject ?: return null
            val category = (root["category"] as? JsonPrimitive)?.takeIf { it.isString }?.content
                ?.let(::decode)?.takeIf { it.isNotBlank() }
            val aliases = (root["aliases"] as? JsonArray).orEmpty()
                .mapNotNull { (it as? JsonPrimitive)?.takeIf { value -> value.isString }?.content }
                .map(::decode).filter { it.isNotBlank() }
            return IconSvgMetadata(category, aliases)
        }

        private fun content(svg: String): String? {
            val start = svg.indexOf(OPEN)
            val open = if (start < 0) -1 else svg.indexOf('>', start)
            val end = if (open < 0 || svg[open - 1] == '/') -1 else svg.indexOf(CLOSE, open)
            return if (end < 0) null else svg.substring(open + 1, end).trim()
        }

        /** Раскодирует XML-сущности (`&amp;`, `&#x41;`, ...); неизвестные остаются как есть. */
        fun decode(text: String): String = buildString {
            var index = 0
            while (index < text.length) {
                val semicolon = if (text[index] == '&') text.indexOf(';', index) else -1
                val replacement = if (semicolon > index) entity(text.substring(index + 1, semicolon)) else null
                if (replacement == null) {
                    append(text[index])
                    index++
                } else {
                    append(replacement)
                    index = semicolon + 1
                }
            }
        }

        private fun entity(body: String): String? = when (body) {
            "amp" -> "&"
            "lt" -> "<"
            "gt" -> ">"
            "quot" -> "\""
            "apos" -> "'"
            else -> numeric(body)
        }

        private fun numeric(body: String): String? {
            val code = when {
                body.startsWith("#x") -> body.drop(2).toIntOrNull(HEX)
                body.startsWith("#") -> body.drop(1).toIntOrNull()
                else -> null
            }
            return code?.takeIf { it in 1..MAX_CODE_POINT }?.let(::codePointToString)
        }

        private fun codePointToString(code: Int): String =
            if (code < SUPPLEMENTARY) {
                code.toChar().toString()
            } else {
                val offset = code - SUPPLEMENTARY
                buildString {
                    append((HIGH_SURROGATE + (offset shr SURROGATE_SHIFT)).toChar())
                    append((LOW_SURROGATE + (offset and SURROGATE_MASK)).toChar())
                }
            }

        private const val HEX = 16
        private const val MAX_CODE_POINT = 0x10FFFF
        private const val SUPPLEMENTARY = 0x10000
        private const val HIGH_SURROGATE = 0xD800
        private const val LOW_SURROGATE = 0xDC00
        private const val SURROGATE_SHIFT = 10
        private const val SURROGATE_MASK = 0x3FF
    }
}
