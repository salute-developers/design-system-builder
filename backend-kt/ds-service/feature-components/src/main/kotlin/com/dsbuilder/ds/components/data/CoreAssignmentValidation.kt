package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.EditorRuleViolationException
import com.dsbuilder.ds.components.domain.CoreValueCompatibility
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/** Проверяет только записываемое назначение; остальные конфликты ДС не запрещают исправление. */
internal fun validateCoreAssignment(
    propertyId: UUID,
    appearanceId: UUID,
    tokenId: UUID?,
    literal: String?,
    stateSetId: UUID,
    referenceSource: StyleReferenceWriter.Source? = null,
) {
    val appearance = ComponentAppearancesTable.selectAll()
        .where { ComponentAppearancesTable.id eq appearanceId }.singleOrNull()
        ?: invalidCoreAssignment("appearance_not_found")
    val componentId = appearance[ComponentAppearancesTable.componentId]
    val property = PropertiesTable.selectAll().where { PropertiesTable.id eq propertyId }.singleOrNull()
        ?: invalidCoreAssignment("CORE_PROPERTY_REMOVED")
    if (property[PropertiesTable.componentId] != componentId) invalidCoreAssignment("property_not_found")
    val type = property[PropertiesTable.type].wireValue
    val platform = coreComponentPlatform(componentId)
    if (type == "component_style") validateStoredReference(propertyId, literal, referenceSource)
    validateCoreValue(type, tokenId, literal, platform, appearance[ComponentAppearancesTable.designSystemId])
    val states = ComponentStateSetsTable.selectAll().where { ComponentStateSetsTable.id eq stateSetId }.singleOrNull()
        ?.get(ComponentStateSetsTable.stateIds) ?: invalidCoreAssignment("state_set_not_found")
    val available = ComponentStatesTable.selectAll().where { ComponentStatesTable.id inList states }
        .filter { it[ComponentStatesTable.componentId] == null || it[ComponentStatesTable.componentId] == componentId }
        .mapTo(hashSetOf()) { it[ComponentStatesTable.id] }
    if (states.any { it !in available }) invalidCoreAssignment("CORE_STATE_REMOVED")
}

private fun invalidCoreAssignment(code: String): Nothing =
    throw EditorRuleViolationException(code, "$code: The value is incompatible with the selected Core")

/** Платформа — часть неизменяемой идентичности компонента, в том числе после удаления из Core. */
internal fun coreComponentPlatform(componentId: UUID): String =
    StableComponentsTable.selectAll().where { StableComponentsTable.id eq componentId }
        .single()[StableComponentsTable.platform].wireValue

private fun validateStoredReference(property: UUID, literal: String?, source: StyleReferenceWriter.Source?) {
    val reference = source?.let(StyleReferenceWriter::existing)
    if (reference == null) {
        if (!literal.isNullOrBlank()) invalidCoreAssignment("reference_required")
        return
    }
    if (reference[ComponentStyleReferencesTable.reference] != literal) invalidCoreAssignment("reference_required")
    val target = ComponentAppearancesTable.selectAll().where {
        ComponentAppearancesTable.id eq reference[ComponentStyleReferencesTable.targetAppearanceId]
    }.singleOrNull() ?: invalidCoreAssignment("reference_target_not_found")
    validateCoreReference(property, target)
}

private fun validateCoreValue(type: String, tokenId: UUID?, literal: String?, platform: String, system: UUID) {
    if (tokenId != null) {
        val token = ComponentTokensTable.selectAll().where { ComponentTokensTable.id eq tokenId }.singleOrNull()
            ?: invalidCoreAssignment("token_not_found")
        if (token[ComponentTokensTable.enabled] == false ||
            token[ComponentTokensTable.designSystemId] != system ||
            !CoreValueCompatibility.tokenFits(type, token[ComponentTokensTable.type])
        ) {
            invalidCoreAssignment("CORE_VALUE_TYPE_CONFLICT")
        }
    } else if (!CoreValueCompatibility.literalFits(
            type,
            literal,
            platform,
        )
    ) {
        invalidCoreAssignment("CORE_VALUE_TYPE_CONFLICT")
    }
}
