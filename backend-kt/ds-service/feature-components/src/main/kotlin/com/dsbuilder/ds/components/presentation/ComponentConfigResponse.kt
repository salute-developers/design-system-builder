package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.domain.ComponentConfig
import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Explicit HTTP representation of the common component configuration. */
@Serializable
@OptIn(ExperimentalSerializationApi::class)
data class ComponentConfigResponse(
    /** Root variation id carried by this contract. */
    val rootVariationId: String?,
    /** Color scheme variation id carried by this contract. */
    val colorSchemeVariationId: String?,
    /** Invariants carried by this contract. */
    val invariants: Map<String, Property>,
    /** Defaults carried by this contract. */
    val defaults: List<Default>,
    /** Variations carried by this contract. */
    val variations: List<Variation>,
) {
    /** HTTP property value. */
    @Serializable
    data class Property(
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Id carried by this contract. */ val id: String? = null,
        /** Type carried by this contract. */
        val type: String,
        @EncodeDefault(
            EncodeDefault.Mode.NEVER,
        ) /** Default carried by this contract. */ val default: JsonElement? = null,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Value carried by this contract. */ val value: JsonElement? = null,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Alpha carried by this contract. */ val alpha: JsonElement? = null,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Adjustment carried by this contract. */ val adjustment:
        JsonElement? = null,
        @EncodeDefault(
            EncodeDefault.Mode.NEVER,
        ) /** States carried by this contract. */ val states: List<State>? = null,
    )

    /** HTTP state override. */
    @Serializable
    data class State(
        /** State carried by this contract. */
        val state: List<String>,
        /** Value carried by this contract. */
        val value: JsonElement,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Alpha carried by this contract. */ val alpha: JsonElement? = null,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Type carried by this contract. */ val type: String? = null,
    )

    /** HTTP axis default. */
    @Serializable
    data class Default(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: JsonElement,
    )

    /** HTTP variation axis. */
    @Serializable
    data class Variation(
        /** Id carried by this contract. */
        val id: String,
        /** Name carried by this contract. */
        val name: String,
        /** Values carried by this contract. */
        val values: List<VariationValue>,
        @EncodeDefault(EncodeDefault.Mode.NEVER) /** Declared type carried by this contract. */ val declaredType:
        String? = null,
    )

    /** HTTP variation value. */
    @Serializable
    data class VariationValue(
        /** Name carried by this contract. */
        val name: String,
        @EncodeDefault(
            EncodeDefault.Mode.NEVER,
        ) /** Targets carried by this contract. */ val targets: List<Target>? = null,
        /** Properties carried by this contract. */
        val properties: Map<String, Property>,
        @EncodeDefault(
            EncodeDefault.Mode.NEVER,
        ) /** Authored id carried by this contract. */ val authoredId: String? = null,
    )

    /** HTTP target group. */
    @Serializable
    data class Target(/** Properties carried by this contract. */ val properties: List<TargetProperty>)

    /** HTTP target coordinate. */
    @Serializable
    data class TargetProperty(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: JsonElement,
    )

    companion object {
        /** Maps the legacy single-config response, which always emits `states`. */
        fun single(value: ComponentConfig): ComponentConfigResponse =
            from(value, emitEmptyStates = true, includeIds = true)

        /** Maps package configs, omitting empty optional fields like the current exporter. */
        fun exported(value: ComponentConfig): ComponentConfigResponse =
            from(value, emitEmptyStates = false, includeIds = false)

        private fun from(
            value: ComponentConfig,
            emitEmptyStates: Boolean,
            includeIds: Boolean,
        ) = ComponentConfigResponse(
            value.rootVariationId,
            value.colorSchemeVariationId,
            value.invariants.mapValues { property(it.value, emitEmptyStates, includeIds) },
            value.defaults.map { Default(it.id, scalar(it.value)) },
            value.variations.map { variation ->
                Variation(
                    variation.id,
                    variation.name,
                    variation.values.map { axisValue ->
                        VariationValue(
                            axisValue.name,
                            axisValue.targets?.map { target ->
                                Target(target.properties.map { TargetProperty(it.id, scalar(it.value)) })
                            },
                            axisValue.properties.mapValues { property(it.value, emitEmptyStates, includeIds) },
                            axisValue.authoredId,
                        )
                    },
                    variation.declaredType,
                )
            },
        )

        private fun property(value: ComponentConfig.Property, emitEmptyStates: Boolean, includeIds: Boolean): Property {
            val scalar = scalar(value.value)
            val paint = value.type == "color" || value.type == "gradient"
            return Property(
                id = value.id.takeIf { includeIds },
                type = value.type,
                default = scalar.takeIf { paint },
                value = scalar.takeUnless { paint },
                alpha = value.alpha?.let(::scalar),
                adjustment = value.adjustment?.let(::scalar),
                states = value.states.takeIf { emitEmptyStates || it.isNotEmpty() }?.map {
                    State(it.state, scalar(it.value), it.alpha?.let(::scalar), it.type)
                },
            )
        }

        private fun scalar(value: ComponentConfig.Scalar): JsonElement = when (value) {
            ComponentConfig.Scalar.Null -> JsonNull
            is ComponentConfig.Scalar.Text -> JsonPrimitive(value.value)
            is ComponentConfig.Scalar.BooleanValue -> JsonPrimitive(value.value)
            is ComponentConfig.Scalar.Number -> value.value.toLongOrNull()?.let(::JsonPrimitive)
                ?: JsonPrimitive(value.value.toDouble())
            is ComponentConfig.Scalar.ArrayValue -> JsonArray(value.value.map(::scalar))
            is ComponentConfig.Scalar.ObjectValue -> JsonObject(value.value.mapValues { scalar(it.value) })
        }
    }
}
