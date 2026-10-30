package com.dsbuilder.ds.designsystems.data

import com.dsbuilder.ds.core.application.DraftChangeCandidate
import com.dsbuilder.ds.core.application.DraftChangeDependencyValidator
import com.dsbuilder.ds.core.application.DraftChangeHandler
import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.DraftSubjectChange
import com.dsbuilder.ds.core.application.ModelReadItems
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.data.discardRevertedEntityEditTracking
import com.dsbuilder.ds.core.data.lockDraftSubject
import com.dsbuilder.ds.core.data.modelReadJournalPage
import com.dsbuilder.ds.core.domain.ProjectId
import com.dsbuilder.ds.designsystems.application.DraftChangeLimitExceededException
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
    private val dependencies: List<DraftChangeDependencyValidator> = emptyList(),
) : DraftChangeRepository {
    override suspend fun summary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): Int? {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId) ?: return null
        return compactReader(designSystemId, target).summary { handler, difference ->
            change(handler, difference, designSystemId, target, null)
        }
    }

    override suspend fun changedTokenIds(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        tenantId: UUID,
    ): Set<UUID>? {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId) ?: return null
        return compactReader(designSystemId, target).tokenIds(tenantId)
    }

    private fun compactReader(owner: DesignSystemId, target: BoundaryRow) = CompactJournalReader(
        handlers,
        policies,
        owner,
        target.id,
        target.sequenceNumber,
        previousSequence(owner, target.sequenceNumber),
    )

    override suspend fun page(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        read: ModelReadQuery,
    ): ModelReadItems<DraftChange>? = list(projectId, systemAdmin, designSystemId, versionId)
        ?.sortedWith(compareBy<DraftChange> { it.entityType }.thenBy { it.entityId.toString() })
        ?.modelReadJournalPage(read, DraftChange::entityType, DraftChange::entityId)

    override suspend fun list(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
    ): List<DraftChange>? {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId) ?: return null
        val previousSequence = previousSequence(designSystemId, target.sequenceNumber)
        val differences = boundedDifferences(target.id, designSystemId.value, target.sequenceNumber, previousSequence)
            ?: throw DraftChangeLimitExceededException()
        val edits = editStates(target.id, differences)
        val changes = differences.map { (subject, difference) ->
            change(subject, difference, designSystemId, target, edits[subject.entityType to difference.entityId])
        }.sortedWith(compareBy(DraftChange::entityType, DraftChange::entityId))
        return changes
    }

    override suspend fun pageAndSummary(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        versionId: DesignSystemVersionId?,
        read: ModelReadQuery,
    ): com.dsbuilder.ds.designsystems.application.DraftJournalRead? {
        val changes = list(projectId, systemAdmin, designSystemId, versionId) ?: return null
        val target = boundary(projectId, systemAdmin, designSystemId, versionId) ?: return null
        return com.dsbuilder.ds.designsystems.application.DraftJournalRead(
            changes.sortedWith(compareBy<DraftChange> { it.entityType }.thenBy { it.entityId.toString() })
                .modelReadJournalPage(read, DraftChange::entityType, DraftChange::entityId),
            compactReader(designSystemId, target).count(changes),
        )
    }

    override suspend fun hasChanges(projectId: ProjectId, designSystemId: DesignSystemId): Boolean? {
        val target = boundary(projectId, false, designSystemId, null) ?: return null
        val previousSequence = previousSequence(designSystemId, target.sequenceNumber)
        return if (policies.all(DraftChangePolicy::preservesNonEmpty)) {
            hasAnyDraftChanges(handlers, designSystemId.value, target.sequenceNumber, previousSequence)
        } else {
            differences(target.id, designSystemId.value, target.sequenceNumber, previousSequence).isNotEmpty()
        }
    }

    override suspend fun revert(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        paths: Set<String>,
    ): DraftChangeRevertResult = checkedRevert {
        revertSubject(projectId, systemAdmin, designSystemId, changeId, expectedRevision, paths)
    }

    @Suppress("ReturnCount") // Прежние предметные отказы остаются явными защитными условиями.
    private suspend fun revertSubject(
        projectId: ProjectId,
        systemAdmin: Boolean,
        designSystemId: DesignSystemId,
        changeId: UUID,
        expectedRevision: Long,
        paths: Set<String>,
    ): DraftChangeRevertResult {
        val target = boundary(projectId, systemAdmin, designSystemId, versionId = null)
            ?: return DraftChangeRevertResult.NotFound
        val lookup = trackedSubject(target.id, designSystemId.value, changeId)
        if (lookup.exceeded) return DraftChangeRevertResult.LimitExceeded
        val tracked = lookup.subject ?: return DraftChangeRevertResult.NotFound
        if (!tracked.handler.prepareRevert(designSystemId.value, tracked.entityId) ||
            !lockDraftSubject(
                designSystemId.value,
                tracked.handler.entityType,
                tracked.entityId,
            )
        ) {
            return DraftChangeRevertResult.NotFound
        }
        val lockedTarget = boundary(projectId, systemAdmin, designSystemId, versionId = null)
            ?: return DraftChangeRevertResult.NotFound
        if (lockedTarget.id != target.id) return DraftChangeRevertResult.NotFound
        val subject = tracked.handler
        val difference = visibleEntity(lockedTarget, designSystemId, tracked)
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
        val result = applyRevert(subject, lockedTarget.id, change, paths)
        return if (result == DraftChangeRevertResult.Reverted &&
            dependencies.any { !it.valid(designSystemId.value, subject.entityType, change.entityId) }
        ) {
            DraftChangeRevertResult.DependencyConflict
        } else {
            result
        }
    }

    private fun visibleEntity(
        target: BoundaryRow,
        designSystemId: DesignSystemId,
        tracked: TrackedSubject,
    ): DraftSubjectChange? {
        val previous = previousSequence(designSystemId, target.sequenceNumber)
        fun related(type: String, id: UUID): DraftSubjectChange? = handlers.firstOrNull { it.entityType == type }
            ?.describeEntity(designSystemId.value, target.sequenceNumber, previous, id)
        var candidate = related(tracked.handler.entityType, tracked.entityId)
            ?.let { DraftChangeCandidate(tracked.handler.entityType, it) } ?: return null
        for (policy in policies) {
            candidate = policy.visibleEntity(target.id, candidate, ::related) ?: return null
        }
        return candidate.change
    }

    private fun trackedSubject(versionId: UUID, owner: UUID, changeId: UUID): SubjectLookup {
        val byType = handlers.associateBy(DraftChangeHandler::entityType)
        if (byType.isEmpty()) return SubjectLookup(null)
        val types = byType.keys.sorted()
        val sql = """
            SELECT entity_type, entity_id FROM entity_edit_states
            WHERE design_system_version_id = ? AND design_system_id = ? AND revision > 0
              AND entity_type IN (${types.joinToString(",") { "?" }})
            ORDER BY entity_type, entity_id LIMIT ${MAX_JOURNAL_CANDIDATES_PER_TYPE + 1}
        """.trimIndent()
        return TransactionManager.current().exec(
            sql,
            listOf(UUIDColumnType() to versionId, UUIDColumnType() to owner) + types.map { TextColumnType() to it },
        ) { rows ->
            var count = 0
            var found: TrackedSubject? = null
            while (rows.next()) {
                if (++count > MAX_JOURNAL_CANDIDATES_PER_TYPE) return@exec SubjectLookup(null, exceeded = true)
                val type = rows.getString("entity_type")
                val entity = rows.getObject("entity_id", UUID::class.java)
                if (stableChangeId(versionId, type, entity) == changeId) {
                    found = TrackedSubject(requireNotNull(byType[type]), entity)
                    break
                }
            }
            SubjectLookup(found)
        } ?: SubjectLookup(null)
    }

    private fun applyRevert(
        subject: DraftChangeHandler,
        versionId: UUID,
        change: DraftChange,
        paths: Set<String>,
    ): DraftChangeRevertResult =
        if (paths.isNotEmpty()) {
            revertFields(subject, versionId, change, paths)
        } else if (change.operation == ChangeOperation.CREATED) {
            revertCreated(subject, versionId, change.entityId)
        } else {
            if (subject.revert(versionId, change.entityId, removeStableEntity = false)) {
                discardRevertedEntityEditTracking(
                    versionId,
                    subject.entityType,
                    change.entityId,
                    removeState = false,
                )
                DraftChangeRevertResult.Reverted
            } else {
                DraftChangeRevertResult.NotFound
            }
        }

    private suspend fun checkedRevert(operation: suspend () -> DraftChangeRevertResult): DraftChangeRevertResult {
        val transaction = TransactionManager.current()
        transaction.exec("SAVEPOINT checked_revert")
        return try {
            val result = operation()
            if (result == DraftChangeRevertResult.Reverted) {
                // Отмена обязана проверить итоговый граф до сохранения успешного ответа, а не при COMMIT.
                transaction.exec("SELECT set_config('ds.palette_checked_boundaries', '', true)")
                transaction.exec("SET CONSTRAINTS ALL IMMEDIATE")
                transaction.exec("SET CONSTRAINTS ALL DEFERRED")
                transaction.exec("SELECT set_config('ds.palette_checked_boundaries', '', true)")
            } else {
                transaction.exec("ROLLBACK TO SAVEPOINT checked_revert")
            }
            transaction.exec("RELEASE SAVEPOINT checked_revert")
            result
        } catch (@Suppress("TooGenericExceptionCaught") failure: Exception) {
            transaction.exec("ROLLBACK TO SAVEPOINT checked_revert")
            transaction.exec("RELEASE SAVEPOINT checked_revert")
            if (listOf("23503", "23505", "23514").any(failure::hasSqlState)) {
                DraftChangeRevertResult.DependencyConflict
            } else {
                throw failure
            }
        }
    }

    private fun revertFields(
        subject: DraftChangeHandler,
        versionId: UUID,
        change: DraftChange,
        paths: Set<String>,
    ): DraftChangeRevertResult {
        val previous = change.previousValue
        val current = change.currentValue
        if (change.operation != ChangeOperation.UPDATED || previous == null || current == null) {
            return DraftChangeRevertResult.InvalidPaths
        }
        return if (subject.revertFields(versionId, change.entityId, previous, current, paths)) {
            DraftChangeRevertResult.Reverted
        } else {
            DraftChangeRevertResult.InvalidPaths
        }
    }

    private fun revertCreated(subject: DraftChangeHandler, versionId: UUID, entityId: UUID): DraftChangeRevertResult {
        if (!subject.canRemoveCreated(versionId, entityId)) return DraftChangeRevertResult.DependencyConflict
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
            editRevision = difference.comparisonRevision ?: edit?.revision ?: 0,
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
        val sql = """
            SELECT revision, last_actor_id, updated_at
            FROM entity_edit_states
            WHERE design_system_version_id = ? AND entity_type = ? AND entity_id = ?
            LIMIT 1
        """.trimIndent()
        return TransactionManager.current().exec(
            sql,
            listOf(
                UUIDColumnType() to versionId,
                TextColumnType() to entityType,
                UUIDColumnType() to entityId,
            ),
        ) { rows ->
            if (rows.next()) {
                EditRow(rows.getLong("revision"), rows.getString("last_actor_id"), rows.instant("updated_at"))
            } else {
                null
            }
        }
    }

    private fun editStates(versionId: UUID, differences: List<TypedDifference>): Map<Pair<String, UUID>, EditRow> {
        if (differences.isEmpty()) return emptyMap()
        val entityIds = differences.map { it.difference.entityId }.distinct()
        val placeholders = entityIds.joinToString(",") { "?" }
        val sql = """
            SELECT entity_type, entity_id, revision, last_actor_id, updated_at
            FROM entity_edit_states
            WHERE design_system_version_id = ? AND entity_id IN ($placeholders)
        """.trimIndent()
        val arguments = listOf(UUIDColumnType() to versionId) + entityIds.map { UUIDColumnType() to it }
        return TransactionManager.current().exec(sql, arguments) { rows ->
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

    private fun boundedDifferences(
        targetVersionId: UUID,
        designSystemId: UUID,
        sequenceNumber: Long,
        previousSequenceNumber: Long,
    ): List<TypedDifference>? {
        val handlersByType = handlers.associateBy(DraftChangeHandler::entityType)
        val candidates = handlers.flatMap { subject ->
            val described = subject.describe(
                designSystemId,
                sequenceNumber,
                previousSequenceNumber,
                limit = MAX_JOURNAL_CANDIDATES_PER_TYPE + 1,
            )
            if (described.size > MAX_JOURNAL_CANDIDATES_PER_TYPE) return null
            described.map { difference -> DraftChangeCandidate(subject.entityType, difference) }
        }
        val visible = policies.fold(candidates) { current, policy -> policy.visible(targetVersionId, current) }
        if (visible.size > MAX_JOURNAL_CHANGES) return null
        return visible.mapNotNull { candidate ->
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
    private data class TrackedSubject(val handler: DraftChangeHandler, val entityId: UUID)
    private data class SubjectLookup(val subject: TrackedSubject?, val exceeded: Boolean = false)
}

internal fun hasAnyDraftChanges(
    handlers: List<DraftChangeHandler>,
    designSystemId: UUID,
    sequenceNumber: Long,
    previousSequenceNumber: Long,
): Boolean = handlers.any { handler ->
    handler.hasChanges(designSystemId, sequenceNumber, previousSequenceNumber)
}

private fun Throwable.hasSqlState(expected: String): Boolean = generateSequence(this) { it.cause }
    .filterIsInstance<SQLException>()
    .any { it.sqlState == expected }

private const val FOREIGN_KEY_VIOLATION = "23503"
private const val MAX_JOURNAL_CHANGES = 10_000
private const val MAX_JOURNAL_CANDIDATES_PER_TYPE = 100_000
