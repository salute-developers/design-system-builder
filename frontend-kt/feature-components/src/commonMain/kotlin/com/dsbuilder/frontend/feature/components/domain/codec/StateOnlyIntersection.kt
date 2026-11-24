package com.dsbuilder.frontend.feature.components.domain.codec

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull

/** Native-генератору нужно базовое значение даже у пересечения только с состояниями. */
internal fun CommonConfig.materializeStateOnly(axis: String, value: CommonVariationValue): CommonVariationValue {
    if (value.properties.values.none { !it.states.isNullOrEmpty() }) {
        return value
    }
    val selected = value.targets.orEmpty().flatMap { it.properties }.associate { it.id to it.value.content } +
        (axis to value.name)
    val inherited = invariants.toMutableMap()
    variations.sortedBy { it.id == colorSchemeVariationId }.flatMap { variation ->
        variation.values.map { candidate ->
            val coordinates = candidate.targets.orEmpty().flatMap { it.properties }
                .associate { it.id to it.value.content } + (variation.id to candidate.name)
            coordinates to candidate
        }
    }.filter { (coordinates, _) ->
        coordinates.size < selected.size && coordinates.all { (name, item) -> selected[name] == item }
    }.sortedBy { it.first.size }.forEach { (_, candidate) ->
        candidate.properties.forEach { (name, property) ->
            inherited[name] = property.overlay(inherited[name])
        }
    }
    return value.copy(
        properties = value.properties.mapValues { (name, property) ->
            if (property.states.isNullOrEmpty()) property else property.overlay(inherited[name])
        },
    )
}

private fun JsonElement?.hasValue(): Boolean = this != null && this != JsonNull

private fun NativeProperty.isStateOnly(): Boolean =
    !states.isNullOrEmpty() && !value.hasValue() && !default.hasValue()

/** База и каждый набор состояний наследуются независимо, как в редакторе и preview. */
private fun NativeProperty.overlay(inherited: NativeProperty?): NativeProperty {
    if (inherited == null || states.isNullOrEmpty()) return this
    val base = if (isStateOnly()) inherited else this
    val inheritedStates = inherited.states.orEmpty().map { it.explicitType(inherited.type, base.type) }
    val ownStates = states.orEmpty().map { it.explicitType(type, base.type) }
    val combined = (inheritedStates + ownStates).associateBy { it.states.sorted() }.values.toList()
    return if (combined.isEmpty()) base else base.copy(states = combined)
}

private fun NativePropertyState.explicitType(sourceType: String, baseType: String): NativePropertyState =
    if (type == null && sourceType != baseType) copy(type = sourceType) else this

/** Нативные генераторы требуют базу у каждого StatefulValue. */
internal fun NativeConfig.missingStateBase(): String? {
    val properties = props.entries + view.values.flatMap { it.props.entries } + variations.flatMap { variation ->
        variation.props.entries + variation.view.values.flatMap { it.props.entries }
    }
    return properties.firstOrNull { it.value.isStateOnly() }?.key
}
