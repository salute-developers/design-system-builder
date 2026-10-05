package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfig
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.UUID

/** HTTP body for atomic package component-config import. */
@Serializable
data class ImportComponentConfigRequest(
    /** Design system id carried by this contract. */
    val designSystemId: String,
    /** Meta carried by this contract. */
    val meta: Meta,
    /** Dry run carried by this contract. */
    val dryRun: Boolean = true,
    /** Components carried by this contract. */
    val components: List<Entry>,
) {
    /** Import source metadata written to the change journal. */
    @Serializable
    data class Meta(
        /** Name carried by this contract. */
        val name: String,
        /** Source carried by this contract. */
        val source: String = "",
    )

    /** One component and appearance payload. */
    @Serializable
    data class Entry(
        /** Component name carried by this contract. */
        val componentName: String,
        /** Style name carried by this contract. */
        val styleName: String,
        /** Config carried by this contract. */
        val config: Config,
    )

    /** Common component configuration accepted by the legacy importer. */
    @Serializable
    data class Config(
        /** Root variation id carried by this contract. */
        val rootVariationId: String? = null,
        /** Color scheme variation id carried by this contract. */
        val colorSchemeVariationId: String? = null,
        /** Invariants carried by this contract. */
        val invariants: Map<String, Property> = emptyMap(),
        /** Defaults carried by this contract. */
        val defaults: List<Default> = emptyList(),
        /** Variations carried by this contract. */
        val variations: List<Variation> = emptyList(),
    )

    /** Imported property value. */
    @Serializable
    data class Property(
        /** Type carried by this contract. */
        val type: String,
        /** Value carried by this contract. */
        val value: JsonElement? = null,
        /** Default carried by this contract. */
        val default: JsonElement? = null,
        /** Alpha carried by this contract. */
        val alpha: JsonElement? = null,
        /** Adjustment carried by this contract. */
        val adjustment: JsonElement? = null,
        /** States carried by this contract. */
        val states: List<State>? = null,
    )

    /** Imported state override. */
    @Serializable
    data class State(
        /** State carried by this contract. */
        val state: List<String> = emptyList(),
        /** Value carried by this contract. */
        val value: JsonElement? = null,
        /** Alpha carried by this contract. */
        val alpha: JsonElement? = null,
        /** Type carried by this contract. */
        val type: String? = null,
    )

    /** Imported default axis coordinate. */
    @Serializable
    data class Default(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: JsonElement,
    )

    /** Imported variation axis. */
    @Serializable
    data class Variation(
        /** Id carried by this contract. */
        val id: String,
        /** Name carried by this contract. */
        val name: String,
        /** Values carried by this contract. */
        val values: List<VariationValue> = emptyList(),
        /** Declared type carried by this contract. */
        val declaredType: String? = null,
    )

    /** Imported axis value. */
    @Serializable
    data class VariationValue(
        /** Name carried by this contract. */
        val name: String,
        /** Authored id carried by this contract. */
        val authoredId: String? = null,
        /** Targets carried by this contract. */
        val targets: List<Target>? = null,
        /** Properties carried by this contract. */
        val properties: Map<String, Property> = emptyMap(),
    )

    /** Imported cross-axis target group. */
    @Serializable
    data class Target(/** Properties carried by this contract. */ val properties: List<TargetProperty> = emptyList())

    /** Imported cross-axis coordinate. */
    @Serializable
    data class TargetProperty(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: JsonElement,
    )

    /** Performs the to command operation. */
    fun toCommand(id: UUID) = ImportComponentConfig(
        id,
        ImportComponentConfig.Meta(meta.name, meta.source),
        dryRun,
        components.map { entry ->
            ImportComponentConfig.Entry(entry.componentName, entry.styleName, entry.config.toDomain())
        },
    )

    private fun Config.toDomain() = ComponentConfig(
        rootVariationId,
        colorSchemeVariationId,
        invariants.mapValues { it.value.toDomain() },
        defaults.map { ComponentConfig.Default(it.id, it.value.toDomain()) },
        variations.map { variation ->
            ComponentConfig.Variation(
                variation.id,
                variation.name,
                variation.values.map { value ->
                    ComponentConfig.VariationValue(
                        value.name,
                        value.targets?.map { target ->
                            ComponentConfig.Target(
                                target.properties.map { ComponentConfig.TargetProperty(it.id, it.value.toDomain()) },
                            )
                        },
                        value.properties.mapValues { it.value.toDomain() },
                        value.authoredId,
                    )
                },
                variation.declaredType,
            )
        },
    )

    private fun Property.toDomain() = ComponentConfig.Property(
        id = null,
        type = type,
        value = (default ?: value ?: JsonNull).toDomain(),
        alpha = alpha?.toDomain(),
        adjustment = adjustment?.toDomain(),
        states = states.orEmpty().map {
            ComponentConfig.State(it.state, (it.value ?: JsonNull).toDomain(), it.alpha?.toDomain(), it.type)
        },
    )

    private fun JsonElement.toDomain(): ComponentConfig.Scalar = when (this) {
        JsonNull -> ComponentConfig.Scalar.Null
        is JsonPrimitive -> when {
            isString -> ComponentConfig.Scalar.Text(content)
            content == "true" || content == "false" -> ComponentConfig.Scalar.BooleanValue(content.toBoolean())
            else -> ComponentConfig.Scalar.Number(content)
        }
        is JsonArray -> ComponentConfig.Scalar.ArrayValue(map { it.toDomain() })
        is JsonObject -> ComponentConfig.Scalar.ObjectValue(mapValues { it.value.toDomain() })
    }
}
