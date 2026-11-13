package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.CoreValueCompatibility
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import java.util.UUID

/** Проверяет независимые ограничения одного назначения по справочникам выбранной границы. */
internal class CoreValueProblems(private val catalog: CoreCompatibilityCatalog) {
    fun reasons(componentId: UUID, value: EditorPropertyValue): List<Pair<String, String>> {
        val property = catalog.properties[value.propertyId]
        val type = property?.get(PropertiesTable.type)?.wireValue
        val blocking = listOfNotNull(
            "CORE_PROPERTY_REMOVED".takeIf {
                property == null || property[PropertiesTable.componentId] != componentId
            },
            tokenProblem(value),
            "CORE_VALUE_TYPE_CONFLICT".takeUnless { valueFits(type, value, componentId) },
            "CORE_STATE_REMOVED".takeIf { invalidStates(componentId, value) },
            "CORE_PLATFORM_PARAM_REMOVED".takeIf {
                catalog.adjustments[value.id].orEmpty().any { adjustment ->
                    catalog.params[adjustment.platformParamId]?.get(PropertyPlatformParamsTable.propertyId) !=
                        value.propertyId
                }
            },
            referenceProblem(type, value),
        ).map { it to "blocking" }
        val deprecated = catalog.params.values.any {
            it[PropertyPlatformParamsTable.propertyId] == value.propertyId && it[PropertyPlatformParamsTable.deprecated]
        }
        return blocking + if (deprecated) listOf("CORE_PROPERTY_DEPRECATED" to "warning") else emptyList()
    }

    private fun tokenProblem(value: EditorPropertyValue): String? {
        val tokenId = value.tokenId ?: return null
        val token = catalog.tokens[tokenId]
        return "CORE_TOKEN_UNAVAILABLE".takeIf { token == null || token[ComponentTokensTable.enabled] == false }
    }

    private fun valueFits(type: String?, value: EditorPropertyValue, componentId: UUID): Boolean {
        if (type == null) return true
        if (value.reference != null) return type == "component_style"
        val tokenType = value.tokenId?.let(catalog.tokens::get)?.get(ComponentTokensTable.type)
        return when {
            tokenType != null -> CoreValueCompatibility.tokenFits(type, tokenType)
            value.tokenId == null -> CoreValueCompatibility.literalFits(
                type,
                value.value,
                catalog.componentPlatforms.getValue(componentId),
            )
            else -> true // Missing tokens have their own diagnostic.
        }
    }

    private fun invalidStates(componentId: UUID, value: EditorPropertyValue): Boolean =
        catalog.sets[value.stateSetId].orEmpty().any { stateId ->
            val state = catalog.states[stateId]
            state == null || state[ComponentStatesTable.componentId]?.let { it != componentId } == true
        }

    private fun referenceProblem(type: String?, value: EditorPropertyValue): String? {
        val reference = value.reference ?: return "CORE_COMPONENT_REFERENCE_UNAVAILABLE".takeIf {
            type == "component_style" && !value.value.isNullOrBlank()
        }
        val target = catalog.appearances[reference.targetAppearanceId]
        val component = target?.get(ComponentAppearancesTable.componentId)
        val available = component in catalog.activeComponents && component in catalog.availableComponents
        val stylesAvailable = reference.styleIds.all { it in EditorSupport.styleAxes(reference.targetAppearanceId) }
        val targets = catalog.componentTargets[value.propertyId].orEmpty()
        return when {
            !available || !stylesAvailable -> "CORE_COMPONENT_REFERENCE_UNAVAILABLE"
            targets.isNotEmpty() && catalog.componentNames[component] !in targets -> "CORE_COMPONENT_TARGET_CONFLICT"
            else -> null
        }
    }
}
