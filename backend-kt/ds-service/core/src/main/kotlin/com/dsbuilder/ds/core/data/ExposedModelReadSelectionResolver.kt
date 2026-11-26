package com.dsbuilder.ds.core.data

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadContext
import com.dsbuilder.ds.core.application.ModelReadSelection
import com.dsbuilder.ds.core.application.ModelReadSelectionResolver
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.ResolvedModelRead
import com.dsbuilder.ds.core.application.valueOr
import org.jetbrains.exposed.v1.core.IColumnType
import org.jetbrains.exposed.v1.core.TextColumnType
import org.jetbrains.exposed.v1.core.UUIDColumnType
import org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager
import java.util.UUID

/** Разрешает ресурс и границу внутри текущей JDBC-транзакции. */
class ExposedModelReadSelectionResolver : ModelReadSelectionResolver {
    private val coreResolver = ExposedCoreContextResolver()

    @Suppress("ReturnCount") // Порядок ранних отказов не раскрывает приватную ДС и предшествует разрешению Core.
    override suspend fun resolve(context: DsRequestContext, target: ModelReadTarget): DsResult<ResolvedModelRead> {
        context.publicRead?.let {
            if (!publiclyAccessible(context)) return DsResult.Failure(DsFailure.NotFound)
            if (context.version == "draft") return DsResult.Failure(DsFailure.Forbidden)
        }
        val selection = ModelReadSelection.parse(
            listOfNotNull(context.version),
            listOfNotNull(context.versionId?.toString()),
        ).valueOr { return it }
        val owner = owner(context, target) ?: return DsResult.Failure(DsFailure.NotFound)
        return if (context.designSystemId != null && context.designSystemId != owner) {
            DsResult.Failure(DsFailure.NotFound)
        } else if (target.kind == ModelReadTarget.Kind.VERSION_HISTORY) {
            val published = context.publicRead?.let {
                TransactionManager.current().exec(
                    "SELECT EXISTS(SELECT 1 FROM design_system_versions WHERE design_system_id = ? " +
                        "AND status = 'published' AND snapshot IS NULL)",
                    listOf(UUIDColumnType() to owner),
                ) { rows ->
                    check(rows.next())
                    rows.getBoolean(1)
                } ?: false
            } ?: true
            if (!published) return DsResult.Failure(DsFailure.NotFound)
            DsResult.Success(
                ResolvedModelRead(
                    context.copy(
                        version = null,
                        versionId = null,
                        readQuery = context.readQuery.copy(scope = "${context.projectId.value}/$owner/history"),
                    ),
                    ModelReadContext(owner, accessMode = context.accessMode),
                ),
            )
        } else {
            resolveBoundary(context, owner, selection)
        }
    }

    private suspend fun resolveBoundary(
        context: DsRequestContext,
        owner: UUID,
        selection: ModelReadSelection,
    ): DsResult<ResolvedModelRead> {
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to owner)
        val predicate = when (selection) {
            ModelReadSelection.Draft -> if (context.publicRead == null) {
                "status = 'draft'"
            } else {
                "status = 'published' AND snapshot IS NULL ORDER BY sequence_number DESC LIMIT 1"
            }
            is ModelReadSelection.Published -> {
                args += TextColumnType() to selection.version
                "status = 'published' AND snapshot IS NULL AND version = ?"
            }
            is ModelReadSelection.ById -> {
                args += UUIDColumnType() to selection.id
                "status = 'published' AND snapshot IS NULL AND id = ?"
            }
        }
        val query = "SELECT id, version FROM design_system_versions WHERE design_system_id = ? AND $predicate"
        val boundary = TransactionManager.current().exec(query, args) { rows ->
            if (rows.next()) rows.getObject("id", UUID::class.java) to rows.getString("version") else null
        } ?: return DsResult.Failure(DsFailure.NotFound)
        val metadata = if (selection == ModelReadSelection.Draft && context.publicRead == null) {
            ModelReadContext(
                owner,
                "draft",
                draftId = boundary.first,
                draftRevision = resolvedDraftRevision(boundary.first),
                coreSelectionRevision = coreSelectionRevision(boundary.first),
            )
        } else {
            ModelReadContext(owner, boundary.second, versionId = boundary.first)
        }
        if (metadata.draftId != null && context.expectedCoreSelectionRevision != null &&
            context.expectedCoreSelectionRevision != metadata.coreSelectionRevision
        ) {
            return DsResult.Failure(DsFailure.Conflict("CORE_CONTEXT_STALE"))
        }
        val coreReleases = withCoreReadScope(owner, metadata.versionId) { coreResolver.resolve(metadata.versionId) }
        val coreScope = coreReleases.joinToString(",") { it.releaseId.toString() }
        return DsResult.Success(
            ResolvedModelRead(
                context.copy(
                    designSystemId = owner,
                    versionId = metadata.versionId,
                    version = null,
                    readQuery = context.readQuery.copy(
                        version = null,
                        scope = "${context.projectId.value}/$owner/" +
                            "${metadata.versionId ?: metadata.draftId}/$coreScope",
                    ),
                ),
                metadata.copy(
                    coreReleases = coreReleases,
                    accessMode = context.accessMode,
                ),
            ),
        )
    }

    private fun publiclyAccessible(context: DsRequestContext): Boolean = TransactionManager.current().exec(
        """
            SELECT EXISTS (
                SELECT 1 FROM design_systems system
                JOIN LATERAL (
                    SELECT deleted FROM design_system_revisions revision
                    WHERE revision.design_system_id = system.id
                    ORDER BY revision.version_sequence_number DESC LIMIT 1
                ) revision ON NOT revision.deleted
                WHERE system.id = ? AND system.project_id = ? AND system.visibility = 'public'
            )
        """.trimIndent(),
        listOf(UUIDColumnType() to context.designSystemId, TextColumnType() to context.projectId.value),
    ) { rows ->
        check(rows.next())
        rows.getBoolean(1)
    } ?: false

    private fun owner(context: DsRequestContext, target: ModelReadTarget): UUID? {
        val resource = when (target.kind) {
            ModelReadTarget.Kind.DESIGN_SYSTEM, ModelReadTarget.Kind.VERSION_HISTORY ->
                "SELECT id AS design_system_id FROM design_systems WHERE id = ?"
            ModelReadTarget.Kind.TOKEN -> "SELECT design_system_id FROM tokens WHERE id = ?"
            ModelReadTarget.Kind.TENANT -> "SELECT design_system_id FROM tenants WHERE id = ?"
            ModelReadTarget.Kind.APPEARANCE -> "SELECT design_system_id FROM appearances WHERE id = ?"
        }
        val args = mutableListOf<Pair<IColumnType<*>, Any?>>(UUIDColumnType() to target.id)
        val accessible = if (context.globalAdmin) {
            "TRUE"
        } else {
            args += TextColumnType() to context.projectId.value
            "(system.project_id = ? OR system.project_id IS NULL)"
        }
        return TransactionManager.current().exec(
            "SELECT system.id FROM ($resource) resource " +
                "JOIN design_systems system ON system.id = resource.design_system_id WHERE $accessible",
            args,
        ) { rows -> if (rows.next()) rows.getObject(1, UUID::class.java) else null }
    }
}
