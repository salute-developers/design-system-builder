package com.dsbuilder.ds.components.application

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull

/** Проверяет `preview-plugin.json` и его согласованность с содержимым архива. */
object PluginManifestParser {
    /** Обязательные файлы архива. */
    val requiredFiles = listOf("index.html", MANIFEST_FILE, META_FILE)

    /** Проверяет manifest [archive]. */
    @Suppress("ReturnCount", "CyclomaticComplexMethod")
    fun parse(archive: PluginArchive): PluginManifestResult {
        requiredFiles.firstOrNull { it !in archive.files }
            ?.let { return invalid("PLUGIN_FILE_MISSING", "В архиве нет файла $it") }
        val root = runCatching { Json.parseToJsonElement(archive.files.getValue(MANIFEST_FILE).decodeToString()) }
            .getOrNull() as? JsonObject
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "$MANIFEST_FILE не является JSON-объектом")
        if (root.int("schemaVersion") != 1) return invalid("PLUGIN_MANIFEST_INVALID", "schemaVersion должен быть 1")
        if (root.string("platform") != "compose") {
            return invalid("PLUGIN_MANIFEST_INVALID", "platform должна быть compose")
        }
        val protocol = root.int("protocolVersion")?.takeIf { it >= 1 }
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "protocolVersion должен быть целым числом")
        val commit = root.string("commit")?.takeIf(COMMIT::matches)
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "commit должен быть sha коммита")
        val version = root.string("version")
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "version не задана")
        if (version != commit.take(BUILD_ID_LENGTH)) {
            return invalid("PLUGIN_VERSION_COMMIT_MISMATCH", "version должна равняться первым 12 символам commit")
        }
        val uikit = root.string("uikitComposeVersion")?.takeIf(SEMVER::matches)
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "uikitComposeVersion должна быть семантической версией")
        val metaSha = root.string("apiMetaSha256")?.takeIf(SHA256::matches)
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "apiMetaSha256 должна быть sha256 в нижнем регистре")
        if (sha256Hex(archive.files.getValue(META_FILE)) != metaSha) {
            return invalid("PLUGIN_META_SHA256_MISMATCH", "sha256 файла $META_FILE не совпадает с apiMetaSha256")
        }
        val entrypoint = root.string("entrypoint")
            ?: return invalid("PLUGIN_MANIFEST_INVALID", "entrypoint не задана")
        if (entrypoint !in archive.files) {
            return invalid("PLUGIN_ENTRYPOINT_MISSING", "Файл entrypoint $entrypoint отсутствует в архиве")
        }
        return PluginManifestResult.Valid(PluginManifest(version, commit, uikit, metaSha, protocol, entrypoint))
    }

    private fun invalid(code: String, message: String) = PluginManifestResult.Invalid(code, message)

    private fun JsonObject.string(name: String): String? =
        (this[name] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull?.takeIf(String::isNotBlank)

    private fun JsonObject.int(name: String): Int? = (this[name] as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull

    /** Имя файла manifest. */
    const val MANIFEST_FILE = "preview-plugin.json"

    /** Имя файла меты. */
    const val META_FILE = "api-meta.json"

    /** Длина идентификатора билда. */
    const val BUILD_ID_LENGTH = 12
    private val COMMIT = Regex("^[0-9a-f]{12,40}$")
    private val SHA256 = Regex("^[0-9a-f]{64}$")
    private val SEMVER = Regex("^\\d+\\.\\d+\\.\\d+([-+][0-9A-Za-z.-]+)?$")
}
