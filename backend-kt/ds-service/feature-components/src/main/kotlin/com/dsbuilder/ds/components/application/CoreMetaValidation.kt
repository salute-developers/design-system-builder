package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.domain.CoreReleaseRef
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.nio.charset.CharacterCodingException
import java.util.Base64

/** Проверка полного релизного запроса до любых изменений каталога. */
internal object CoreMetaValidation {
    /** Возвращает безопасную причину отказа, не раскрывая содержимое файла или SQL. */
    fun error(command: ImportApiMeta, supportedTypes: Set<String>): String? {
        if (missingMetadata(command)) {
            return "CORE_RELEASE_METADATA_REQUIRED"
        }
        val release = requireNotNull(command.coreRelease)
        val names = command.components.map { it.name }.toSet()
        return when {
            command.channel !in setOf("stable", "dev") -> "CORE_RELEASE_INVALID_CHANNEL"
            !release.valid() || CoreReleaseRef.canonicalPlatform(release.platform) != command.platform ->
                "CORE_RELEASE_INVALID_PLATFORM"
            else -> sourceError(command)
                ?: command.components.firstNotNullOfOrNull { componentError(it, names, supportedTypes) }
                ?: duplicateError(command)
        }
    }

    /** Отличает старый клиент от некорректного содержимого нового релиза. */
    fun missingMetadata(command: ImportApiMeta): Boolean =
        listOf(command.coreRelease, command.channel, command.sourceMetaBase64, command.metaSha256).any { it == null }

    private fun componentError(component: ImportApiMeta.Component, names: Set<String>, types: Set<String>): String? =
        when {
            component.name.isBlank() || component.states.any(String::isBlank) -> "CORE_META_INVALID_COMPONENT"
            component.dependencies.conflictingBy { it.component } ->
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
        property.aliases.conflictingBy { it.name } ->
            "CORE_META_CONFLICTING_ALIAS: $component.${property.name}"
        else -> null
    }

    private fun sourceError(command: ImportApiMeta): String? {
        val encoded = requireNotNull(command.sourceMetaBase64)
        val bytes = runCatching { Base64.getDecoder().decode(encoded) }.getOrNull()
            ?: return "CORE_META_INVALID_BASE64"
        val hash = sha256Hex(bytes)
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
        val components = if (platform == "xml") (array as? JsonObject)?.get("components") else array
        return if (components is JsonArray) null else "CORE_META_INVALID_SHAPE"
    }

    private fun duplicateError(command: ImportApiMeta): String? {
        for ((name, components) in command.components.groupBy { it.name }) {
            if (components.map { it.description to it.dependencies }.distinct().size > 1
            ) {
                return "CORE_META_CONFLICTING_COMPONENT: $name"
            }
            val conflictingProperty = components.flatMap { it.properties }.groupBy { it.name }
                .entries.firstOrNull { (_, properties) ->
                    properties.map { it.copy(aliases = emptyList()) }.distinct().size > 1 ||
                        properties.flatMap { it.aliases }.conflictingBy { it.name }
                }
            conflictingProperty?.let { return "CORE_META_CONFLICTING_PROPERTY: $name.${it.key}" }
        }
        return null
    }

    /** Identical repeats are allowed; two different definitions of one key reject the release. */
    private fun <T, K> List<T>.conflictingBy(key: (T) -> K): Boolean =
        distinct().groupBy(key).values.any { it.size > 1 }
}
