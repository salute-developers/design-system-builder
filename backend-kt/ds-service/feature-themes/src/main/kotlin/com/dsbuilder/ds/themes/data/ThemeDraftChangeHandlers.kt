package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangeCandidate
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import com.dsbuilder.ds.core.data.discardRevertedEntityEditTracking
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenFamilyTypeSync
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.core.less
import org.jetbrains.exposed.v1.core.neq
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

/**
 * Предметные обработчики журнала тем. После отката создания или удаления темы [familyTypes] пересчитывает тип
 * семейств цветовых токенов: значения темы перестают или снова начинают в нём участвовать. Откат изменения темы
 * тип не пересчитывает.
 */
fun themeDraftChangeHandlers(
    familyTypes: ColorTokenFamilyTypeSync = ColorTokenFamilyTypeSync(ExposedColorTokenRepository()),
): List<DraftChangeHandler> = listOf(tenantDraftChangeHandler(familyTypes)) + paletteDraftChangeHandlers()

/** Скрывает технические создания начальных значений новой темы за одной записью tenant. */
fun themeDraftChangePolicy(): DraftChangePolicy = object : DraftChangePolicy {
    override val preservesNonEmpty: Boolean = true

    override fun visible(versionId: UUID, candidates: List<DraftChangeCandidate>): List<DraftChangeCandidate> =
        visibleThemeChanges(versionId, candidates)

    override fun visibleEntity(
        versionId: UUID,
        candidate: DraftChangeCandidate,
        related: (String, UUID) -> DraftSubjectChange?,
    ): DraftChangeCandidate? {
        val tenant = candidate.change.currentValue?.get("tenant_id")?.jsonPrimitive?.content
            ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?.takeIf { candidate.change.previousValue == null }
            ?.let { related(TENANT_ENTITY_TYPE, it) }
        val context = listOfNotNull(candidate, tenant?.let { DraftChangeCandidate(TENANT_ENTITY_TYPE, it) })
        return visibleThemeChanges(versionId, context).firstOrNull {
            it.entityType == candidate.entityType && it.change.entityId == candidate.change.entityId
        }
    }
}

private fun visibleThemeChanges(versionId: UUID, candidates: List<DraftChangeCandidate>): List<DraftChangeCandidate> {
    val createdTenantIds = candidates.asSequence()
        .filter { it.entityType == TENANT_ENTITY_TYPE && it.change.previousValue == null }
        .map { it.change.entityId.toString() }
        .toSet()
    val newThemeValues = candidates.filter { candidate ->
        candidate.entityType == TOKEN_VALUE_ENTITY_TYPE && candidate.change.previousValue == null &&
            candidate.change.currentValue?.get("tenant_id")?.jsonPrimitive?.content in createdTenantIds
    }
    val newThemeValueIds = newThemeValues.mapTo(hashSetOf()) { it.change.entityId }
    val baselines = if (newThemeValues.isEmpty()) {
        emptyMap()
    } else {
        ThemeTokenValueCreationBaselinesTable.selectAll().where {
            (ThemeTokenValueCreationBaselinesTable.designSystemVersionId eq versionId) and
                (ThemeTokenValueCreationBaselinesTable.tokenValueId inList newThemeValueIds)
        }.associate { row ->
            row[ThemeTokenValueCreationBaselinesTable.tokenValueId] to InitialTokenValue(
                row[ThemeTokenValueCreationBaselinesTable.paletteId],
                row[ThemeTokenValueCreationBaselinesTable.value],
                row[ThemeTokenValueCreationBaselinesTable.overridden],
            )
        }
    }
    return candidates.mapNotNull { candidate ->
        if (candidate.entityType == "palette-group" && candidate.change.previousValue == null) {
            val current = candidate.change.currentValue
            if (current?.get("kind")?.jsonPrimitive?.content == "system" &&
                current["tenant_id"]?.jsonPrimitive?.content in createdTenantIds
            ) {
                return@mapNotNull null
            }
        }
        if (candidate.entityType != TOKEN_VALUE_ENTITY_TYPE || candidate.change.entityId !in newThemeValueIds) {
            return@mapNotNull candidate
        }
        val current = candidate.change.currentValue ?: return@mapNotNull null
        val baseline = baselines[candidate.change.entityId] ?: return@mapNotNull null
        val previous = JsonObject(
            current + mapOf(
                "palette_id" to baseline.paletteId.json(),
                "value" to (baseline.value ?: JsonNull),
                "overridden" to JsonPrimitive(baseline.overridden),
            ),
        )
        val changedPaths = setOf("palette_id", "value", "overridden")
            .filterTo(linkedSetOf()) { field -> previous[field] != current[field] }
            .mapTo(linkedSetOf()) { field -> "/$field" }
        candidate.takeIf { changedPaths.isNotEmpty() }?.copy(
            change = candidate.change.copy(previousValue = previous, changedPaths = changedPaths),
        )
    }
}

private fun UUID?.json(): JsonElement = this?.let { JsonPrimitive(it.toString()) } ?: JsonNull

private data class InitialTokenValue(val paletteId: UUID?, val value: JsonElement?, val overridden: Boolean)

/** Обработчик журнала темы ([TENANT_ENTITY_TYPE]) с пересчётом типа семейств [familyTypes] после отката. */
internal fun tenantDraftChangeHandler(familyTypes: ColorTokenFamilyTypeSync): DraftChangeHandler {
    val delegate = ExposedDraftChangeHandler(
        entityType = TENANT_ENTITY_TYPE,
        stableTable = TenantsTable,
        stableId = TenantsTable.id,
        stableDesignSystemId = TenantsTable.designSystemId,
        revisionTable = TenantRevisionsTable,
        revisionEntityId = TenantRevisionsTable.tenantId,
        revisionVersionId = TenantRevisionsTable.designSystemVersionId,
        revisionSequenceNumber = TenantRevisionsTable.versionSequenceNumber,
        revisionDeleted = TenantRevisionsTable.deleted,
        revisionValueColumns = listOf(
            TenantRevisionsTable.name,
            TenantRevisionsTable.description,
            TenantRevisionsTable.colorConfig,
        ),
    )
    return object : DraftChangeHandler by delegate {
        override fun revert(versionId: UUID, entityId: UUID, removeStableEntity: Boolean): Boolean {
            val designSystemId = TenantsTable.selectAll().where { TenantsTable.id eq entityId }
                .singleOrNull()?.get(TenantsTable.designSystemId)
            // Тип семейств зависит только от набора тем: пересчёт нужен при откате создания или удаления темы.
            val membershipChanges = removeStableEntity || tenantExistenceChanges(versionId, entityId)
            if (removeStableEntity) removeDraftOnlyTokenValues(versionId, entityId)
            val reverted = delegate.revert(versionId, entityId, removeStableEntity)
            if (reverted && membershipChanges && designSystemId != null) {
                familyTypes.syncTenantFamilies(designSystemId, entityId)
            }
            return reverted
        }
    }
}

/**
 * Меняет ли черновая редакция темы [tenantId] её существование относительно предыдущей границы: создание или
 * удаление (путь `/deleted`). Правки имени, описания и цветовой конфигурации набор тем не меняют.
 */
private fun tenantExistenceChanges(versionId: UUID, tenantId: UUID): Boolean {
    val draft = TenantRevisionsTable.selectAll().where {
        (TenantRevisionsTable.tenantId eq tenantId) and (TenantRevisionsTable.designSystemVersionId eq versionId)
    }.singleOrNull() ?: return false
    val previous = TenantRevisionsTable.selectAll().where {
        (TenantRevisionsTable.tenantId eq tenantId) and (TenantRevisionsTable.designSystemVersionId neq versionId) and
            (TenantRevisionsTable.versionSequenceNumber less draft[TenantRevisionsTable.versionSequenceNumber])
    }.orderBy(TenantRevisionsTable.versionSequenceNumber, SortOrder.DESC).limit(1).singleOrNull()
    val existedBefore = previous?.get(TenantRevisionsTable.deleted) == false
    return existedBefore == draft[TenantRevisionsTable.deleted]
}

private fun removeDraftOnlyTokenValues(versionId: UUID, tenantId: UUID) {
    val valueIds = ThemeTokenValuesTable.selectAll()
        .where { ThemeTokenValuesTable.tenantId eq tenantId }
        .map { it[ThemeTokenValuesTable.id] }
    if (valueIds.isEmpty()) return
    ThemeTokenValueRevisionsTable.deleteWhere {
        (ThemeTokenValueRevisionsTable.tokenValueId inList valueIds) and
            (ThemeTokenValueRevisionsTable.designSystemVersionId eq versionId)
    }
    valueIds.forEach { valueId ->
        discardRevertedEntityEditTracking(versionId, TOKEN_VALUE_ENTITY_TYPE, valueId, removeState = true)
    }
    ThemeTokenValuesTable.deleteWhere { ThemeTokenValuesTable.id inList valueIds }
}

/** Тип сущности журнала темы. */
internal const val TENANT_ENTITY_TYPE = "tenant"
private const val TOKEN_VALUE_ENTITY_TYPE = "token-value"
