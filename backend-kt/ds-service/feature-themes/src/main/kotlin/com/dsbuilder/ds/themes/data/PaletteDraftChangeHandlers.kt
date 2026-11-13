package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.data.ExposedDraftChangeHandler
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.jetbrains.exposed.v1.core.JoinType
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.jdbc.selectAll
import java.util.UUID

internal fun paletteDraftChangeHandlers(): List<DraftChangeHandler> = listOf(
    ExposedDraftChangeHandler(
        "palette-group", StablePaletteGroups, StablePaletteGroups.id, StablePaletteGroups.designSystemId,
        PaletteGroupRevisions, PaletteGroupRevisions.entityId, PaletteGroupRevisions.designSystemVersionId,
        PaletteGroupRevisions.versionSequenceNumber, PaletteGroupRevisions.deleted,
        listOf(StablePaletteGroups.tenantId, StablePaletteGroups.kind, StablePaletteGroups.systemKey),
        listOf(PaletteGroupRevisions.label, PaletteGroupRevisions.position),
    ),
    ExposedDraftChangeHandler(
        "palette-ramp", StablePaletteRamps, StablePaletteRamps.id, StablePaletteRamps.designSystemId,
        PaletteRampRevisions, PaletteRampRevisions.entityId, PaletteRampRevisions.designSystemVersionId,
        PaletteRampRevisions.versionSequenceNumber, PaletteRampRevisions.deleted,
        listOf(StablePaletteRamps.groupId, StablePaletteRamps.slotType, StablePaletteRamps.slotShade),
        listOf(
            PaletteRampRevisions.sourceType,
            PaletteRampRevisions.sourceShade,
            PaletteRampRevisions.added,
            PaletteRampRevisions.origin,
            PaletteRampRevisions.anchorStep,
            PaletteRampRevisions.anchorValue,
        ),
    ),
    ExposedDraftChangeHandler(
        "palette-step", StablePaletteSteps, StablePaletteSteps.id, StablePaletteSteps.designSystemId,
        PaletteStepRevisions, PaletteStepRevisions.entityId, PaletteStepRevisions.designSystemVersionId,
        PaletteStepRevisions.versionSequenceNumber, PaletteStepRevisions.deleted,
        listOf(StablePaletteSteps.rampId, StablePaletteSteps.step),
        listOf(PaletteStepRevisions.value),
    ),
    ExposedDraftChangeHandler(
        "palette-token-group", StablePaletteAssignments, StablePaletteAssignments.id,
        StablePaletteAssignments.designSystemId,
        PaletteAssignmentRevisions, PaletteAssignmentRevisions.entityId,
        PaletteAssignmentRevisions.designSystemVersionId,
        PaletteAssignmentRevisions.versionSequenceNumber, PaletteAssignmentRevisions.deleted,
        listOf(StablePaletteAssignments.tenantId, StablePaletteAssignments.tokenId),
        listOf(PaletteAssignmentRevisions.groupId),
    ),
    ExposedDraftChangeHandler(
        "token-group", StableTokenGroups, StableTokenGroups.id, StableTokenGroups.designSystemId,
        TokenGroupRevisions, TokenGroupRevisions.entityId, TokenGroupRevisions.designSystemVersionId,
        TokenGroupRevisions.versionSequenceNumber, TokenGroupRevisions.deleted,
        listOf(StableTokenGroups.kind),
        listOf(
            TokenGroupRevisions.parentId,
            TokenGroupRevisions.code,
            TokenGroupRevisions.label,
            TokenGroupRevisions.position,
        ),
    ),
).map(::withPaletteLocation).let(::withPaletteRebuildJournal)

private fun withPaletteLocation(delegate: DraftChangeHandler): DraftChangeHandler =
    object : DraftChangeHandler by delegate {
        override fun describeEntity(
            designSystemId: UUID,
            sequenceNumber: Long,
            previousSequenceNumber: Long,
            entityId: UUID,
        ): DraftSubjectChange? {
            val change = delegate.describeEntity(designSystemId, sequenceNumber, previousSequenceNumber, entityId)
                ?: return null
            val location = paletteLocations(delegate.entityType, listOf(entityId))[entityId].orEmpty()
            return change.copy(
                previousValue = change.previousValue?.let { JsonObject(it + location) },
                currentValue = change.currentValue?.let { JsonObject(it + location) },
            )
        }

        override fun describe(
            designSystemId: UUID,
            sequenceNumber: Long,
            previousSequenceNumber: Long,
            limit: Int?,
        ): List<DraftSubjectChange> {
            return located(delegate.describe(designSystemId, sequenceNumber, previousSequenceNumber, limit))
        }

        override fun visit(
            designSystemId: UUID,
            sequenceNumber: Long,
            previousSequenceNumber: Long,
            consume: (List<DraftSubjectChange>) -> Unit,
        ) = delegate.visit(designSystemId, sequenceNumber, previousSequenceNumber) { batch -> consume(located(batch)) }

        private fun located(changes: List<DraftSubjectChange>): List<DraftSubjectChange> {
            val locations = paletteLocations(delegate.entityType, changes.map { it.entityId })
            return changes.map { change ->
                val location = locations[change.entityId].orEmpty()
                change.copy(
                    previousValue = change.previousValue?.let { JsonObject(it + location) },
                    currentValue = change.currentValue?.let { JsonObject(it + location) },
                )
            }
        }
    }

private fun paletteLocations(entityType: String, entityIds: List<UUID>): Map<UUID, JsonObject> {
    if (entityIds.isEmpty() || entityType !in setOf("palette-ramp", "palette-step")) return emptyMap()
    val ramps = StablePaletteRamps.join(
        StablePaletteGroups,
        JoinType.INNER,
        StablePaletteRamps.groupId,
        StablePaletteGroups.id,
    )
    val table = if (entityType == "palette-step") {
        ramps.join(StablePaletteSteps, JoinType.INNER, StablePaletteRamps.id, StablePaletteSteps.rampId)
    } else {
        ramps
    }
    val entityColumn = if (entityType == "palette-step") StablePaletteSteps.id else StablePaletteRamps.id
    val rows = table.selectAll().where { entityColumn inList entityIds }.toList()
    val groupLabels = TenantPaletteGroupsTable.selectAll().where {
        TenantPaletteGroupsTable.id inList rows.map { it[StablePaletteGroups.id] }.distinct()
    }.associate { it[TenantPaletteGroupsTable.id] to it[TenantPaletteGroupsTable.label] }
    return rows.associate { row ->
        row[entityColumn] to JsonObject(
            mapOf(
                "tenant_id" to JsonPrimitive(row[StablePaletteGroups.tenantId].toString()),
                "group_id" to JsonPrimitive(row[StablePaletteGroups.id].toString()),
                "group_label" to JsonPrimitive(groupLabels[row[StablePaletteGroups.id]]),
                "slot_type" to JsonPrimitive(row[StablePaletteRamps.slotType].wireValue),
                "slot_shade" to JsonPrimitive(row[StablePaletteRamps.slotShade]),
            ),
        )
    }
}
