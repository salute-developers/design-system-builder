package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.CoreValueCompatibility
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.StateSetRule
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
            stateProblem(componentId, value, property?.get(PropertiesTable.stateCombinations)),
            "CORE_PLATFORM_PARAM_REMOVED".takeIf {
                catalog.adjustments[value.id].orEmpty().any { adjustment ->
                    catalog.params[adjustment.platformParamId]?.get(PropertyPlatformParamsTable.propertyId) !=
                        value.propertyId
                }
            },
            referenceProblem(type, value, componentId),
        ).map { it to "blocking" }
        val deprecated = value.propertyId in catalog.deprecatedPropertyIds
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
        return if (value.tokenId == null) {
            CoreValueCompatibility.literalFits(type, value.value, catalog.componentPlatforms.getValue(componentId))
        } else {
            CoreValueCompatibility.tokenFits(type, tokenType)
        }
    }

    private fun stateProblem(componentId: UUID, value: EditorPropertyValue, combinations: Boolean?): String? {
        val states = catalog.sets[value.stateSetId].orEmpty()
        if (states.isEmpty()) return null
        val scopes = states.map { id -> catalog.stateScopes[id] ?: return "CORE_STATE_REMOVED" }
        val supported = combinations?.let { catalog.supportedStates[value.propertyId].orEmpty() }
        return when (StateSetRule.check(componentId, supported, combinations == true, scopes)) {
            StateSetRule.Verdict.ALLOWED -> null
            StateSetRule.Verdict.FOREIGN_STATE -> "CORE_STATE_REMOVED"
            StateSetRule.Verdict.NOT_SUPPORTED -> "CORE_STATE_SET_UNSUPPORTED"
        }
    }

    private fun referenceProblem(type: String?, value: EditorPropertyValue, sourceComponentId: UUID): String? {
        val reference = value.reference ?: return "CORE_COMPONENT_REFERENCE_UNAVAILABLE".takeIf {
            type == "component_style" && !value.value.isNullOrBlank()
        }
        val target = catalog.appearances[reference.targetAppearanceId]
        val component = target?.get(ComponentAppearancesTable.componentId)
        val available = component in catalog.activeComponents && component in catalog.availableComponents &&
            catalog.componentPlatforms[component] == catalog.componentPlatforms[sourceComponentId]
        val stylesAvailable = reference.styleIds.all {
            it in catalog.styleIdsByAppearance[reference.targetAppearanceId].orEmpty()
        }
        val targets = catalog.componentTargets[value.propertyId].orEmpty()
        return when {
            !available || !stylesAvailable -> "CORE_COMPONENT_REFERENCE_UNAVAILABLE"
            targets.isNotEmpty() && catalog.componentNames[component] !in targets -> "CORE_COMPONENT_TARGET_CONFLICT"
            else -> null
        }
    }
}
