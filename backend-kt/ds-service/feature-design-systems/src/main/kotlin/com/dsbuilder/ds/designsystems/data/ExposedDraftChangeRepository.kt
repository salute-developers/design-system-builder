package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DraftChangeCandidate
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.data.discardRevertedEntityEditTracking
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DraftChangeRepository
import com.dsbuilder.ds.designsystems.domain.ChangeOperation
import com.dsbuilder.ds.designsystems.domain.DesignSystemId
import com.dsbuilder.ds.designsystems.domain.DesignSystemVersionId
import com.dsbuilder.ds.designsystems.domain.DraftChange
import com.dsbuilder.ds.designsystems.domain.DraftChangeRevertResult
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.LongColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.nio.charset.StandardCharsets
import java.sql.ResultSet
import java.sql.SQLException
import java.time.Instant
import java.util.UUID

/** PostgreSQL implementation of a journal computed from typed subject revision tables. */
class ExposedDraftChangeRepository(
    private val handlers: List<DraftChangeHandler> = listOf(designSystemDraftChangeHandler()),
    private val policies: List<DraftChangePolicy> = emptyList(),
) : DraftChangeRepository {
    override suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): List<DraftChange>? {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId) ?: return null
        val previousSequence = previousSequence(designSystemId, target.sequenceNumber)
        val differences = differences(target.id, designSystemId.value, target.sequenceNumber, previousSequence)
        val edits = editStates(target.id)
        return differences.map { (subject, difference) ->
            change(subject, difference, designSystemId, target, edits[subject.entityType to difference.entityId])
        }.sortedWith(compareBy(DraftChange::entityType, DraftChange::entityId))
    }

    override suspend fun hasChanges(projectId: ProjectId, designSystemId: DesignSystemId): Boolean? {
        val target = boundary(projectId, false, designSystemId, null) ?: return null
        val previousSequence = previousSequence(designSystemId, target.sequenceNumber)
        return differences(target.id, designSystemId.value, target.sequenceNumber, previousSequence).isNotEmpty()
    }

    @Suppress("ReturnCount")
    override suspend fun revert(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
    ): DraftChangeRevertResult {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId = null)
            ?: return DraftChangeRevertResult.NotFound
        val previousSequence = previousSequence(designSystemId, target.sequenceNumber)
        val discoveredChange = differences(target.id, designSystemId.value, target.sequenceNumber, previousSequence)
            .firstOrNull { stableChangeId(target.id, it.subject.entityType, it.difference.entityId) == changeId }
            ?: return DraftChangeRevertResult.NotFound
        if (!lockDraftSubject(
                designSystemId.value,
                discoveredChange.subject.entityType,
                discoveredChange.difference.entityId,
            )
        ) {
            return DraftChangeRevertResult.NotFound
        }
        val lockedTarget = boundary(projectId, systemAdmin, designSystemId, versionId = null)
            ?: return DraftChangeRevertResult.NotFound
        val subject = discoveredChange.subject
        val difference = differences(
            lockedTarget.id,
            designSystemId.value,
            lockedTarget.sequenceNumber,
            previousSequence(designSystemId, lockedTarget.sequenceNumber),
        ).firstOrNull { stableChangeId(lockedTarget.id, it.subject.entityType, it.difference.entityId) == changeId }
            ?.difference
            ?: return DraftChangeRevertResult.NotFound
        val change = change(
            subject,
            difference,
            designSystemId,
            lockedTarget,
            editState(lockedTarget.id, subject.entityType, difference.entityId),
        )
        if (change.editRevision != expectedRevision) {
            return DraftChangeRevertResult.Stale(change.editRevision)
        }
        return if (change.operation == ChangeOperation.CREATED) {
            revertCreated(subject, lockedTarget.id, change.entityId)
        } else {
            if (subject.revert(lockedTarget.id, change.entityId, removeStableEntity = false)) {
                discardRevertedEntityEditTracking(
                    lockedTarget.id,
                    subject.entityType,
                    change.entityId,
                    removeState = false,
                )
                DraftChangeRevertResult.Reverted
            } else {
                DraftChangeRevertResult.NotFound
            }
        }
    }

    private fun revertCreated(subject: DraftChangeHandler, versionId: UUID, entityId: UUID): DraftChangeRevertResult {
        val transaction = TransactionManager.current()
        transaction.exec("SAVEPOINT revert_created_entity")
        return try {
            val removed = subject.revert(versionId, entityId, removeStableEntity = true)
            if (removed) {
                discardRevertedEntityEditTracking(versionId, subject.entityType, entityId, removeState = true)
            }
            if (!removed) transaction.exec("ROLLBACK TO SAVEPOINT revert_created_entity")
            transaction.exec("RELEASE SAVEPOINT revert_created_entity")
            if (removed) DraftChangeRevertResult.Reverted else DraftChangeRevertResult.NotFound
        } catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
            transaction.exec("ROLLBACK TO SAVEPOINT revert_created_entity")
            transaction.exec("RELEASE SAVEPOINT revert_created_entity")
            if (failure.hasSqlState(FOREIGN_KEY_VIOLATION)) {
                DraftChangeRevertResult.DependencyConflict
            } else {
                throw failure
            }
        }
    }

    private fun change(
        subject: DraftChangeHandler,
        difference: DraftSubjectChange,
        designSystemId: DesignSystemId,
        target: BoundaryRow,
        edit: EditRow?,
    ): DraftChange {
        val previous = difference.previousValue
        val current = difference.currentValue
        val operation = when {
            previous == null && current != null -> ChangeOperation.CREATED
            previous != null && current == null -> ChangeOperation.DELETED
            else -> ChangeOperation.UPDATED
        }
        return DraftChange(
            changeId = stableChangeId(target.id, subject.entityType, difference.entityId),
            versionId = DesignSystemVersionId(target.id),
            designSystemId = designSystemId,
            entityType = subject.entityType,
            entityId = difference.entityId,
            operation = operation,
            changedPaths = difference.changedPaths,
            previousValue = previous,
            currentValue = current,
            actorId = edit?.actorId,
            changedAt = edit?.changedAt ?: target.createdAt,
            editRevision = edit?.revision ?: 0,
        )
    }

    private fun boundary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): BoundaryRow? {
        val requested = versionId?.let { "boundary.id = ? AND boundary.status = 'published'" }
            ?: "boundary.status = 'draft'"
        val access = if (systemAdmin) "TRUE" else "system.project_id = ?"
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to designSystemId.value)
        versionId?.let { args += UUIDColumnType() to it.value }
        if (!systemAdmin) args += TextColumnType() to projectId.value
        val sql = """
            SELECT boundary.id, boundary.sequence_number, boundary.created_at
            FROM design_system_versions boundary
            JOIN design_systems system ON system.id = boundary.design_system_id
            WHERE boundary.design_system_id = ? AND $requested AND $access
              AND boundary.snapshot IS NULL
            LIMIT 1
        """.trimIndent()
        return TransactionManager.current().exec(sql, args) { rows ->
            if (rows.next()) rows.toBoundary() else null
        }
    }

    private fun previousSequence(designSystemId: DesignSystemId, before: Long): Long {
        val sql = """
            SELECT COALESCE(
                max(sequence_number) FILTER (WHERE status = 'published'),
                max(sequence_number) FILTER (WHERE status = 'baseline')
            ) AS sequence_number
            FROM design_system_versions
            WHERE design_system_id = ? AND sequence_number < ?
        """.trimIndent()
        return TransactionManager.current().exec(
            sql,
            listOf(UUIDColumnType() to designSystemId.value, LongColumnType() to before),
        ) { rows ->
            check(rows.next())
            rows.getLong("sequence_number")
        } ?: error("Previous version boundary is missing")
    }

    private fun editState(versionId: UUID, entityType: String, entityId: UUID): EditRow? {
        return editStates(versionId)[entityType to entityId]
    }

    private fun editStates(versionId: UUID): Map<Pair<String, UUID>, EditRow> {
        val sql = """
            SELECT entity_type, entity_id, revision, last_actor_id, updated_at
            FROM entity_edit_states
            WHERE design_system_version_id = ?
        """.trimIndent()
        return TransactionManager.current().exec(sql, listOf(UUIDColumnType() to versionId)) { rows ->
            buildMap {
                while (rows.next()) {
                    put(
                        rows.getString("entity_type") to rows.getObject("entity_id", UUID::class.java),
                        EditRow(rows.getLong("revision"), rows.getString("last_actor_id"), rows.instant("updated_at")),
                    )
                }
            }
        }.orEmpty()
    }

    private fun ResultSet.toBoundary() = BoundaryRow(
        id = getObject("id", UUID::class.java),
        sequenceNumber = getLong("sequence_number"),
        createdAt = instant("created_at"),
    )

    private fun differences(
        targetVersionId: UUID,
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
    ): List<TypedDifference> {
        val handlersByType = handlers.associateBy(DraftChangeHandler::entityType)
        val candidates = handlers.flatMap { subject ->
            subject.describe(designSystemId, sequenceNumber, previousSequenceNumber)
                .map { difference -> DraftChangeCandidate(subject.entityType, difference) }
        }
        return policies.fold(candidates) { visible, policy -> policy.visible(targetVersionId, visible) }
            .mapNotNull { candidate ->
                handlersByType[candidate.entityType]?.let { TypedDifference(it, candidate.change) }
            }
    }

    private fun ResultSet.instant(column: String): Instant = getTimestamp(column).toInstant()

    private fun stableChangeId(versionId: UUID, entityType: String, entityId: UUID): UUID = UUID.nameUUIDFromBytes(
        "$versionId:$entityType:$entityId".toByteArray(StandardCharsets.UTF_8),
    )

    private data class BoundaryRow(val id: UUID, val sequenceNumber: Long, val createdAt: Instant)
    private data class EditRow(val revision: Long, val actorId: String, val changedAt: Instant)
    private data class TypedDifference(val subject: DraftChangeHandler, val difference: DraftSubjectChange)
}

private fun Throwable.hasSqlState(expected: String): Boolean = generateSequence(this) { it.cause }
    .filterIsInstance<SQLException>()
    .any { it.sqlState == expected }

private const val FOREIGN_KEY_VIOLATION = "23503"
