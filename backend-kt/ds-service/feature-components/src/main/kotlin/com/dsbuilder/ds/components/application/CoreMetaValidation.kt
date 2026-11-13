package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.domain.CoreReleaseRef
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.nio.charset.CharacterCodingException
import java.security.MessageDigest
import java.util.Base64

/** Проверка полного релизного запроса до любых изменений каталога. */
internal object CoreMetaValidation {
    /** Возвращает безопасную причину отказа, не раскрывая содержимое файла или SQL. */
    fun error(command: ImportApiMeta, supportedTypes: Set<String>): String? {
        val release = command.coreRelease ?: return "CORE_RELEASE_REQUIRED"
        if (!release.valid() || CoreReleaseRef.canonicalPlatform(release.platform) != command.platform) {
            return "CORE_RELEASE_INVALID_PLATFORM"
        }
        val names = command.components.map { it.name }.toSet()
        return sourceError(command)
            ?: command.components.firstNotNullOfOrNull { componentError(it, names, supportedTypes) }
            ?: duplicateError(command)
    }

    private fun componentError(component: ImportApiMeta.Component, names: Set<String>, types: Set<String>): String? =
        when {
            component.name.isBlank() || component.states.any(String::isBlank) -> "CORE_META_INVALID_COMPONENT"
            component.dependencies.groupBy { it.component }.values.any { it.distinct().size > 1 } ->
                "CORE_META_CONFLICTING_DEPENDENCY: ${component.name}"
            component.dependencies.any { it.component !in names || it.type != "compose" } ->
                "CORE_META_INVALID_DEPENDENCY: ${component.name}"
            else -> component.properties.firstNotNullOfOrNull { propertyError(component.name, it, names, types) }
        }

    private fun propertyError(
        component: String,
        property: ImportApiMeta.Property,
        names: Set<String>,
        types: Set<String>,
    ): String? = when {
        property.name.isBlank() || property.type !in types ->
            "CORE_META_INVALID_PROPERTY: $component.${property.name}: ${property.type}"
        property.aliases.isEmpty() || property.aliases.any { it.name.isBlank() } ->
            "CORE_META_INVALID_ALIAS: $component.${property.name}"
        property.componentTargets.any { it !in names } -> "CORE_META_UNKNOWN_COMPONENT_TARGET"
        property.aliases.groupBy { it.name }.values.any { it.distinct().size > 1 } ->
            "CORE_META_CONFLICTING_ALIAS: $component.${property.name}"
        else -> null
    }

    private fun sourceError(command: ImportApiMeta): String? {
        val encoded = command.sourceMetaBase64 ?: return "CORE_META_SOURCE_REQUIRED"
        val bytes = runCatching { Base64.getDecoder().decode(encoded) }.getOrNull()
            ?: return "CORE_META_INVALID_BASE64"
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        return if (hash != command.metaSha256) "CORE_META_SHA256_MISMATCH" else shapeError(bytes, command.platform)
    }

    private fun shapeError(bytes: ByteArray, platform: String): String? {
        val array = try {
            Json.parseToJsonElement(bytes.decodeToString(throwOnInvalidSequence = true))
        } catch (_: IllegalArgumentException) {
            return "CORE_META_INVALID_JSON"
        } catch (_: CharacterCodingException) {
            return "CORE_META_INVALID_UTF8"
        }
        val supportedShape = array is JsonArray ||
            (platform == "xml" && array is JsonObject && array["components"] is JsonArray)
        return if (supportedShape) null else "CORE_META_INVALID_SHAPE"
    }

    private fun duplicateError(command: ImportApiMeta): String? {
        for ((name, components) in command.components.groupBy { it.name }) {
            if (components.map { it.description }.distinct().size > 1 ||
                components.map { it.dependencies }.distinct().size > 1
            ) {
                return "CORE_META_CONFLICTING_COMPONENT: $name"
            }
            for ((propertyName, properties) in components.flatMap { it.properties }.groupBy { it.name }) {
                if (properties.map { it.copy(aliases = emptyList()) }.distinct().size > 1 ||
                    properties.flatMap { it.aliases }.groupBy { it.name }.values.any { it.distinct().size > 1 }
                ) {
                    return "CORE_META_CONFLICTING_PROPERTY: $name.$propertyName"
                }
            }
        }
        return null
    }
}
