package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import java.util.UUID

internal class ComponentConfigImportContext(
    val tokens: Map<String, UUID>,
    entries: List<ImportComponentConfig.Entry>,
) {
    val report = ComponentConfigImportReport()
    val styleToComponent = entries.associate { it.styleName to it.componentName }
    val interactionStates = linkedMapOf<String, UUID>()
    val componentStates = linkedMapOf<String, UUID>()
    val stateSets = linkedMapOf<List<UUID>, UUID>()
    val pendingReferences = mutableListOf<PendingComponentStyleReference>()
    val componentIds = linkedMapOf<String, UUID?>()
    val paintTypes = linkedMapOf<String, MutableSet<String>>()
}

internal data class PendingComponentStyleReference(
    val reference: String,
    val source: ComponentStyleSource,
)

internal sealed interface ComponentStyleSource {
    val id: UUID

    data class Invariant(override val id: UUID) : ComponentStyleSource

    data class Variation(override val id: UUID) : ComponentStyleSource

    data class Combination(override val id: UUID) : ComponentStyleSource
}

internal class ComponentConfigImportReport {
    var created = 0
    var updated = 0
    var unchanged = 0
    val rejected = mutableListOf<ComponentConfigImportResult.Rejection>()
    val unresolvedTokens = linkedSetOf<String>()
    val unresolvedComponentStyles = linkedSetOf<String>()
    val unknownProperties = linkedSetOf<String>()
    val unknownStates = linkedSetOf<String>()
    val typeMismatches = linkedSetOf<String>()
    val underivableVariationIds = linkedSetOf<String>()

    fun reject(entry: ImportComponentConfig.Entry, reason: String) {
        rejected += ComponentConfigImportResult.Rejection(entry.componentName, entry.styleName, reason)
    }

    fun toDomain(paintTypes: Map<String, Set<String>>) = ComponentConfigImportResult(
        created = created,
        updated = updated,
        unchanged = unchanged,
        rejected = rejected,
        unresolvedTokens = unresolvedTokens.sorted(),
        unresolvedComponentStyles = unresolvedComponentStyles.sorted(),
        unknownProperties = unknownProperties.sorted(),
        unknownStates = unknownStates.sorted(),
        typeMismatches = typeMismatches.sorted(),
        gradientOnlyProperties = paintTypes.filterValues { it == setOf("gradient") }.keys.sorted(),
        underivableVariationIds = underivableVariationIds.sorted(),
    )
}
