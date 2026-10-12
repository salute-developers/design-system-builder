package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.ImportApiMeta
import com.dsbuilder.ds.components.domain.AliasDeprecation
import com.dsbuilder.ds.components.domain.ApiMetaAlias
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * HTTP body of the API-meta import sent by `dsbuilder components import-api`.
 *
 * The platform meta format (`stateEnum`, `group`, `paramSimpleType`, `attrName`) is parsed by the CLI:
 * the backend receives ready components, properties and states, so a new platform needs no parser here.
 * The property type is a string: its allowed values belong to the stored type vocabulary and an unknown
 * one rejects the property instead of failing the whole request.
 */
@Serializable
data class ImportApiMetaRequest(
    /** Platform of the manifest. */
    val platform: String,
    /** Reference information about the meta file. */
    val meta: Meta = Meta(),
    /** Whether the work is rolled back after the report is produced. */
    val dryRun: Boolean = true,
    /** Components carried by the manifest. */
    val components: List<Component>,
) {
    /** Reference information about the meta file. */
    @Serializable
    data class Meta(/** File name of the meta (not a path). */ val source: String = "")

    /** One component of the manifest. */
    @Serializable
    data class Component(
        /** Component name. */
        val name: String,
        /** Properties of the component. */
        val properties: List<Property> = emptyList(),
        /** States declared by the component. */
        val states: List<String> = emptyList(),
    )

    /** One property of the manifest. */
    @Serializable
    data class Property(
        /** Property name. */
        val name: String,
        /** Property type. */
        val type: String,
        /** Platform names: a string (no deprecation information) or `{name, deprecated?: {message}}`. */
        val platformNames: List<JsonElement>? = null,
        /** The earlier single-name field, still accepted from already released CLI versions. */
        val platformName: String? = null,
        /** Optional description. */
        val description: String? = null,
    )

    /** True when the body satisfies the contract that the generated serializer cannot express. */
    fun valid(): Boolean = platform in componentPlatforms && components.isNotEmpty() &&
        components.all { component ->
            component.name.isNotEmpty() && component.states.none(String::isEmpty) &&
                component.properties.all { property ->
                    property.name.isNotEmpty() && property.type.isNotEmpty() && property.aliases() != null
                }
        }

    /** Performs the to command operation. */
    fun toCommand() = ImportApiMeta(
        platform,
        meta.source,
        dryRun,
        components.map { component ->
            ImportApiMeta.Component(
                component.name,
                component.properties.map {
                    ImportApiMeta.Property(it.name, it.type, requireNotNull(it.aliases()), it.description)
                },
                component.states,
            )
        },
    )

    /**
     * Platform names without repeats, or null when none is given or one is malformed.
     * `platformNames` wins over the earlier `platformName`.
     */
    private fun Property.aliases(): List<ApiMetaAlias>? {
        val source = when {
            platformNames != null -> platformNames.map { it.alias() ?: return null }.takeIf { it.isNotEmpty() }
            platformName != null && platformName.isNotEmpty() ->
                listOf(ApiMetaAlias(platformName, AliasDeprecation.Unknown))
            else -> null
        }
        return source?.let(ApiMetaAlias::merge)
    }

    private fun JsonElement.alias(): ApiMetaAlias? = when (this) {
        is JsonPrimitive ->
            if (isString && content.isNotEmpty()) ApiMetaAlias(content, AliasDeprecation.Unknown) else null
        is JsonObject -> {
            val name = (get("name") as? JsonPrimitive)?.takeIf { it.isString && it.content.isNotEmpty() }?.content
            val deprecated = get("deprecated")
            when {
                name == null -> null
                deprecated == null || deprecated is kotlinx.serialization.json.JsonNull ->
                    ApiMetaAlias(name, AliasDeprecation.Current)
                deprecated is JsonObject ->
                    (deprecated["message"] as? JsonPrimitive)?.takeIf { it.isString }
                        ?.let { ApiMetaAlias(name, AliasDeprecation.Deprecated(it.content)) }
                else -> null
            }
        }
        else -> null
    }
}
