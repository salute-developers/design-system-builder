package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.EntityEditStateRepository
import com.dsbuilder.ds.core.domain.DraftBoundaryRef
import com.dsbuilder.ds.core.domain.EntityEditPath
import com.dsbuilder.ds.core.domain.EntityEditState
import com.dsbuilder.ds.core.domain.LogicalEntityRef
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.core.greater
import org.jetbrains.exposed.v1.core.inList
import org.jetbrains.exposed.v1.javatime.timestamp
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import org.jetbrains.exposed.v1.jdbc.update
import org.postgresql.util.PGobject
import java.time.Instant
import java.util.UUID

private object EntityEditStatesTable : Table("entity_edit_states") {
    val designSystemVersionId = uuid("design_system_version_id")
    val designSystemId = uuid("design_system_id")
    val entityType = text("entity_type")
    val entityId = uuid("entity_id")
    val revision = long("revision")
    val lastActorId = text("last_actor_id")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(designSystemVersionId, entityType, entityId)
}

private object EntityEditPathsTable : Table("entity_edit_paths") {
    val designSystemVersionId = uuid("design_system_version_id")
    val designSystemId = uuid("design_system_id")
    val entityType = text("entity_type")
    val entityId = uuid("entity_id")
    val path = text("path")
    val lastRevision = long("last_revision")
    val lastActorId = text("last_actor_id")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(designSystemVersionId, entityType, entityId, path)
}

private object EditVersionBoundariesTable : Table("design_system_versions") {
    val id = uuid("id")
    val designSystemId = uuid("design_system_id")
    val status = customEnumeration(
        "status",
        "design_system_version_status",
        { value -> EditBoundaryStatus.entries.first { it.wireValue == value.toString() } },
        { value ->
            PGobject().apply {
                type = "design_system_version_status"
                this.value = value.wireValue
            }
        },
    )
}

private object EditDesignSystemsTable : Table("design_systems") {
    val id = uuid("id")
    val projectId = text("project_id").nullable()
}

private enum class EditBoundaryStatus(val wireValue: String) { DRAFT("draft") }

/** Не допускает публикацию до завершения обычной предметной транзакции этой дизайн-системы. */
fun lockDesignSystemMutation(designSystemId: UUID) {
    TransactionManager.current().exec(
        "SELECT pg_advisory_xact_lock_shared(hashtextextended(CAST(? AS text), 684313))",
        listOf(UUIDColumnType() to designSystemId),
    )
}

/** Получает исключительную блокировку границы публикации этой дизайн-системы. */
fun lockDesignSystemPublication(designSystemId: UUID) {
    TransactionManager.current().exec(
        "SELECT pg_advisory_xact_lock(hashtextextended(CAST(? AS text), 684313))",
        listOf(UUIDColumnType() to designSystemId),
    )
}

/**
 * Serializes read-modify-write for one logical entity before its resolved
 * subject revision is read. The revision trigger advances the same row after
 * the new subject revision is inserted.
 */
fun lockDraftSubject(designSystemId: UUID, entityType: String, entityId: UUID): Boolean {
    val requestScope = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current().exec(
        """
            SELECT NULLIF(current_setting('ds.project_id', true), '') AS project_id,
                   COALESCE(NULLIF(current_setting('ds.system_admin', true), '')::boolean, false) AS system_admin
        """.trimIndent(),
    ) { rows ->
        check(rows.next())
        rows.getString("project_id") to rows.getBoolean("system_admin")
    }
    val projectId = requestScope?.first
    val systemAdmin = requestScope?.second == true
    if (projectId != null && !systemAdmin) {
        val owned = EditDesignSystemsTable.selectAll().where {
            (EditDesignSystemsTable.id eq designSystemId) and (EditDesignSystemsTable.projectId eq projectId)
        }.limit(1).any()
        if (!owned) return false
    }
    lockDesignSystemMutation(designSystemId)
    val boundaryId = EditVersionBoundariesTable.selectAll().where {
        (EditVersionBoundariesTable.designSystemId eq designSystemId) and
            (EditVersionBoundariesTable.status eq EditBoundaryStatus.DRAFT)
    }.singleOrNull()?.get(EditVersionBoundariesTable.id) ?: return false
    val actorId = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current().exec(
        "SELECT COALESCE(NULLIF(current_setting('ds.actor_id', true), ''), 'system')",
    ) { rows -> if (rows.next()) rows.getString(1) else "system" } ?: "system"
    EntityEditStatesTable.insertIgnore {
        it[designSystemVersionId] = boundaryId
        it[EntityEditStatesTable.designSystemId] = designSystemId
        it[EntityEditStatesTable.entityType] = entityType
        it[EntityEditStatesTable.entityId] = entityId
        it[revision] = 0
        it[lastActorId] = actorId
        it[updatedAt] = Instant.now()
    }
    EntityEditStatesTable.selectAll().where {
        (EntityEditStatesTable.designSystemVersionId eq boundaryId) and
            (EntityEditStatesTable.entityType eq entityType) and
            (EntityEditStatesTable.entityId eq entityId)
    }.forUpdate().single()
    return true
}

/** PostgreSQL-реализация технических редакций сущности и её путей. */
class ExposedEntityEditStateRepository : EntityEditStateRepository {
    override suspend fun lock(
        boundary: DraftBoundaryRef,
        entity: LogicalEntityRef,
        actorId: String,
    ): EntityEditState {
        EntityEditStatesTable.insertIgnore {
            it[designSystemVersionId] = boundary.versionId
            it[designSystemId] = boundary.designSystemId
            it[entityType] = entity.type
            it[entityId] = entity.id
            it[revision] = 0
            it[lastActorId] = actorId
            it[updatedAt] = Instant.now()
        }
        return stateQuery(boundary, entity).forUpdate().single().toState(boundary, entity)
    }

    override suspend fun changedPathsSince(
        boundary: DraftBoundaryRef,
        entity: LogicalEntityRef,
        revision: Long,
    ): List<EntityEditPath> = EntityEditPathsTable.selectAll().where {
        (EntityEditPathsTable.designSystemVersionId eq boundary.versionId) and
            (EntityEditPathsTable.entityType eq entity.type) and
            (EntityEditPathsTable.entityId eq entity.id) and
            (EntityEditPathsTable.lastRevision greater revision)
    }.map { row ->
        EntityEditPath(
            row[EntityEditPathsTable.path],
            row[EntityEditPathsTable.lastRevision],
            row[EntityEditPathsTable.lastActorId],
            row[EntityEditPathsTable.updatedAt],
        )
    }

    override suspend fun advance(
        boundary: DraftBoundaryRef,
        entity: LogicalEntityRef,
        paths: Set<String>,
        actorId: String,
    ): EntityEditState {
        require(paths.isNotEmpty()) { "At least one changed path is required" }
        require(paths.all { it.startsWith("/") }) { "Changed paths must be JSON pointers" }
        val current = stateQuery(boundary, entity).forUpdate().single()
        val nextRevision = current[EntityEditStatesTable.revision] + 1
        val changedAt = Instant.now()
        val statePredicate = (EntityEditStatesTable.designSystemVersionId eq boundary.versionId) and
            (EntityEditStatesTable.entityType eq entity.type) and
            (EntityEditStatesTable.entityId eq entity.id)
        EntityEditStatesTable.update({ statePredicate }) {
            it[revision] = nextRevision
            it[lastActorId] = actorId
            it[updatedAt] = changedAt
        }
        paths.forEach { changedPath ->
            val pathPredicate = (EntityEditPathsTable.designSystemVersionId eq boundary.versionId) and
                (EntityEditPathsTable.entityType eq entity.type) and
                (EntityEditPathsTable.entityId eq entity.id) and
                (EntityEditPathsTable.path eq changedPath)
            val updated = EntityEditPathsTable.update({ pathPredicate }) {
                it[lastRevision] = nextRevision
                it[lastActorId] = actorId
                it[updatedAt] = changedAt
            }
            if (updated == 0) {
                EntityEditPathsTable.insert {
                    it[designSystemVersionId] = boundary.versionId
                    it[designSystemId] = boundary.designSystemId
                    it[entityType] = entity.type
                    it[entityId] = entity.id
                    it[path] = changedPath
                    it[lastRevision] = nextRevision
                    it[lastActorId] = actorId
                    it[updatedAt] = changedAt
                }
            }
        }
        return EntityEditState(boundary, entity, nextRevision, actorId, changedAt)
    }

    private fun stateQuery(boundary: DraftBoundaryRef, entity: LogicalEntityRef) =
        EntityEditStatesTable.selectAll().where {
            (EntityEditStatesTable.designSystemVersionId eq boundary.versionId) and
                (EntityEditStatesTable.designSystemId eq boundary.designSystemId) and
                (EntityEditStatesTable.entityType eq entity.type) and
                (EntityEditStatesTable.entityId eq entity.id)
        }
}

/** Возвращает технические ревизии набора сущностей внутри одной границы версии. */
fun entityEditRevisions(
    versionId: UUID,
    entityType: String,
    entityIds: Set<UUID>,
): Map<UUID, Long> {
    if (entityIds.isEmpty()) return emptyMap()
    return EntityEditStatesTable.selectAll().where {
        (EntityEditStatesTable.designSystemVersionId eq versionId) and
            (EntityEditStatesTable.entityType eq entityType) and
            (EntityEditStatesTable.entityId inList entityIds)
    }.associate { row -> row[EntityEditStatesTable.entityId] to row[EntityEditStatesTable.revision] }
}

/**
 * Удаляет сведения о путях отменённого изменения. Для отменённого создания удаляет также состояние уже не
 * существующей в черновике сущности; связанные пути удаляются внешним ключом.
 */
fun discardRevertedEntityEditTracking(
    versionId: UUID,
    entityType: String,
    entityId: UUID,
    removeState: Boolean,
) {
    val predicate = (EntityEditStatesTable.designSystemVersionId eq versionId) and
        (EntityEditStatesTable.entityType eq entityType) and
        (EntityEditStatesTable.entityId eq entityId)
    if (removeState) {
        EntityEditStatesTable.deleteWhere { predicate }
    } else {
        EntityEditPathsTable.deleteWhere {
            (EntityEditPathsTable.designSystemVersionId eq versionId) and
                (EntityEditPathsTable.entityType eq entityType) and
                (EntityEditPathsTable.entityId eq entityId)
        }
    }
}

private fun ResultRow.toState(boundary: DraftBoundaryRef, entity: LogicalEntityRef) = EntityEditState(
    boundary,
    entity,
    this[EntityEditStatesTable.revision],
    this[EntityEditStatesTable.lastActorId],
    this[EntityEditStatesTable.updatedAt],
)
