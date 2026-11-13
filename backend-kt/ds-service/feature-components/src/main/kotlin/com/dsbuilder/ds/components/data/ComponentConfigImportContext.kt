package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.ImportComponentConfig
import com.dsbuilder.ds.components.domain.ComponentConfigImportResult
import java.util.UUID

internal class ComponentConfigImportContext(
    /** Дизайн-система импорта: все оформления пакета принадлежат ей, поэтому её не нужно перечитывать из базы. */
    val designSystemId: UUID,
    val tokens: Map<String, UUID>,
    entries: List<ImportComponentConfig.Entry>,
    /** Platform of the import: components are looked up only among components of this platform. */
    val platform: ComponentPlatformDb,
) {
    val report = ComponentConfigImportReport()
    val styleToComponent = entries.associate { it.styleName to it.componentName }
    val interactionStates = linkedMapOf<String, UUID>()
    val componentStates = linkedMapOf<String, UUID>()
    val stateSets = linkedMapOf<List<UUID>, UUID>()
    val pendingReferences = mutableListOf<PendingComponentStyleReference>()

    /** Каталог компонентов платформы по каноническому имени: читается один раз на импорт. */
    var platformComponents: Map<String, org.jetbrains.exposed.v1.core.ResultRow>? = null

    /** Свойства компонента по каноническому имени: читаются один раз на компонент, а не на каждое имя в конфигурации. */
    val propertyRows = hashMapOf<UUID, Map<String, org.jetbrains.exposed.v1.core.ResultRow>>()

    /** Состояния компонента по каноническому имени, прочитанные один раз на компонент. */
    val statesByComponent = hashMapOf<UUID, Map<String, UUID>>()

    /** Стили осей по имени, прочитанные один раз на ось; несколько идентификаторов означают неоднозначное имя. */
    val styleIds = hashMapOf<UUID, MutableMap<String, List<UUID>>>()

    /** Оформления, созданные этим импортом. */
    val newAppearances = hashSetOf<UUID>()

    /** Запоминает оформление, в которое пишет импорт, и отмечает, создано ли оно им. */
    fun track(appearance: UUID, created: Boolean) {
        appearances += appearance
        if (created) newAppearances += appearance
    }

    /** Дочерние компоненты со связью `REUSE` по родителю, прочитанные один раз на импорт. */
    val reuseChildren = hashMapOf<UUID, MutableSet<UUID>>()

    /** Цели ссылок на стили по паре (компонент, оформление). */
    val referenceTargets = hashMapOf<Pair<UUID, String>, ReferenceTarget>()

    /** Компоненты, связь которых с дизайн-системой уже проверена в этом импорте. */
    val linkedComponents = hashSetOf<UUID>()

    /** Свойства, связанные с осью, по оси: читаются один раз на ось и дополняются при вставке. */
    val linkedProperties = hashMapOf<UUID, MutableSet<UUID>>()
    val paintTypes = linkedMapOf<String, MutableSet<String>>()
    val sync = ComponentConfigImportSync()
    val appearances = linkedSetOf<UUID>()
    val completed = mutableListOf<() -> Unit>()
}

/**
 * Цель ссылки на стиль: оформление, его стили вариаций по имени каталога и по действующему имени, а также стили
 * значений и сочетаний по исходному идентификатору (`authored_id`).
 */
internal class ReferenceTarget(
    val appearance: org.jetbrains.exposed.v1.core.ResultRow?,
    val available: Map<String, UUID>,
    val effective: Map<String, UUID>,
    val authored: Map<String, List<UUID>> = emptyMap(),
)

internal data class PendingComponentStyleReference(
    val propertyId: UUID,
    val reference: String,
    val source: ComponentStyleSource,
    /** Оформление, значение которого содержит ссылку: запись ссылки считается изменением этого оформления. */
    val appearance: UUID?,
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
