package com.dsbuilder.ds.components.domain

/** Canonical common component configuration returned by the server builders. */
data class ComponentConfig(
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
    /** One property value with optional state overrides. */
    data class Property(
        /** Id carried by this contract. */
        val id: String?,
        /** Type carried by this contract. */
        val type: String,
        /** Value carried by this contract. */
        val value: Scalar,
        /** Alpha carried by this contract. */
        val alpha: Scalar? = null,
        /** Adjustment carried by this contract. */
        val adjustment: Scalar? = null,
        /** States carried by this contract. */
        val states: List<State> = emptyList(),
    )

    /** State-specific property override. */
    data class State(
        /** State carried by this contract. */
        val state: List<String>,
        /** Value carried by this contract. */
        val value: Scalar,
        /** Alpha carried by this contract. */
        val alpha: Scalar? = null,
        /** Type carried by this contract. */
        val type: String? = null,
    )

    /** Default value of one variation axis. */
    data class Default(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: Scalar,
    )

    /** Declared variation axis. */
    data class Variation(
        /** Id carried by this contract. */
        val id: String,
        /** Name carried by this contract. */
        val name: String,
        /** Values carried by this contract. */
        val values: List<VariationValue>,
        /** Declared type carried by this contract. */
        val declaredType: String? = null,
    )

    /** One axis value and properties applied at its coordinates. */
    data class VariationValue(
        /** Name carried by this contract. */
        val name: String,
        /** Targets carried by this contract. */
        val targets: List<Target>? = null,
        /** Properties carried by this contract. */
        val properties: Map<String, Property>,
        /** Authored id carried by this contract. */
        val authoredId: String? = null,
    )

    /** One group of cross-axis coordinates. */
    data class Target(/** Properties carried by this contract. */ val properties: List<TargetProperty>)

    /** Coordinate of another variation axis. */
    data class TargetProperty(
        /** Id carried by this contract. */
        val id: String,
        /** Value carried by this contract. */
        val value: Scalar,
    )

    /** JSON value preserved independently from HTTP serialization. */
    sealed interface Scalar {
        /** Public model for null. */
        data object Null : Scalar

        /** Public model for text. */
        data class Text(/** Value carried by this contract. */ val value: String) : Scalar

        /** Public model for number. */
        data class Number(/** Value carried by this contract. */ val value: String) : Scalar

        /** Public model for boolean value. */
        data class BooleanValue(/** Value carried by this contract. */ val value: Boolean) : Scalar

        /** Public model for array value. */
        data class ArrayValue(/** Value carried by this contract. */ val value: List<Scalar>) : Scalar

        /** Public model for object value. */
        data class ObjectValue(/** Value carried by this contract. */ val value: Map<String, Scalar>) : Scalar
    }
}
